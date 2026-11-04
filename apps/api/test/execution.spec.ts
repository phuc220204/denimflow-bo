import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { type INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.setup.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { seedCatalog } from '../src/seed/catalog.js';
import { seedUsers } from '../src/seed/users.js';
import { DEMO_STYLE_CODE, seedWorkflow } from '../src/seed/workflow.js';

// Tokens map to the seeded demo profiles (src/seed/users.ts); the operator works at CUT-01.
const users: Record<string, { id: string; role: string }> = {
  'Bearer planner-token': {
    id: '00000000-0000-0000-0000-000000000003',
    role: 'PRODUCTION_PLANNER',
  },
  'Bearer pe-token': { id: '00000000-0000-0000-0000-000000000002', role: 'PROCESS_ENGINEER' },
  'Bearer operator-token': { id: '00000000-0000-0000-0000-000000000005', role: 'STATION_OPERATOR' },
  'Bearer manager-token': { id: '00000000-0000-0000-0000-000000000007', role: 'MANAGER' },
};

const fakeAuthService = {
  async getMe(authHeader?: string) {
    const user = authHeader ? users[authHeader] : undefined;
    if (!user) {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ hoặc đã hết hạn');
    }
    return { ...user, email: 'x@denimflow.test', fullName: 'Test', isActive: true };
  },
};

describe('Execution: worklist, start and complete (T4.2)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let orderId: string;
  let stepIds: Record<string, string>;

  const statusOf = async (code: string) =>
    (await prisma.stepInstance.findUniqueOrThrow({ where: { id: stepIds[code] } })).status;

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    await seedCatalog(prisma);
    await seedUsers(prisma, null, '');
    await seedWorkflow(prisma);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AuthService)
      .useValue(fakeAuthService)
      .compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    // Listen once so concurrent supertest requests share one server.
    await app.listen(0);

    const [style, fabric, color, washType] = await Promise.all([
      prisma.style.findUniqueOrThrow({ where: { styleCode: DEMO_STYLE_CODE } }),
      prisma.fabricType.findUniqueOrThrow({ where: { code: 'DN-12-RIGID' } }),
      prisma.colorOption.findUniqueOrThrow({ where: { code: 'CLR-INDIGO' } }),
      prisma.washType.findUniqueOrThrow({ where: { code: 'WSH-STONE' } }),
    ]);
    const order = await prisma.productionOrder.create({
      data: {
        orderNumber: `T42-${randomUUID().slice(0, 8)}`,
        styleId: style.id,
        fabricTypeId: fabric.id,
        colorId: color.id,
        washTypeId: washType.id,
        dyeRequired: true,
        dyeMode: 'TOTAL',
        dyeSource: 'INTERNAL',
        dueDate: new Date('2026-12-31'),
        createdBy: users['Bearer planner-token']!.id,
        sizeLines: { create: [{ size: '30', plannedQty: 100 }] },
      },
    });
    orderId = order.id;

    await request(app.getHttpServer())
      .post(`/orders/${orderId}/confirm`)
      .set('Authorization', 'Bearer planner-token')
      .expect((res) => expect(res.status).toBeLessThan(300));

    const steps = await prisma.stepInstance.findMany({
      where: { instance: { orderId } },
      include: { stepDefinition: true },
    });
    stepIds = Object.fromEntries(steps.map((s) => [s.stepDefinition.code, s.id]));
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
  });

  it('requires a login for the worklist (401) and lets any role read it', async () => {
    await request(app.getHttpServer()).get('/worklist').expect(401);
    await request(app.getHttpServer())
      .get('/worklist')
      .set('Authorization', 'Bearer manager-token')
      .expect(200);
  });

  it('keeps DYEING and EFFECT_WASH pending after a completion (same order.* context as Confirm)', async () => {
    const server = app.getHttpServer();
    await request(server)
      .post(`/steps/${stepIds.FABRIC_COLOR_SELECT}/start`)
      .set('Authorization', 'Bearer planner-token')
      .expect(200);
    const completed = await request(server)
      .post(`/steps/${stepIds.FABRIC_COLOR_SELECT}/complete`)
      .set('Authorization', 'Bearer planner-token')
      .expect(200);

    expect(completed.body.newlyReadyStepCodes).toEqual(['BOM_ALLOCATE']);
    expect(completed.body.newlySkippedStepCodes).toEqual([]);
    expect(await statusOf('DYEING')).toBe('PENDING');
    expect(await statusOf('EFFECT_WASH')).toBe('PENDING');
    // BR-14: EMBROIDERY was skipped at Confirm, but SEWING still waits for CUTTING.
    expect(await statusOf('SEWING')).toBe('PENDING');
    // BR-11 / R-23: who finished the step is recorded.
    const done = await prisma.stepInstance.findUniqueOrThrow({
      where: { id: stepIds.FABRIC_COLOR_SELECT },
    });
    expect(done.completedBy).toBe(users['Bearer planner-token']!.id);
  });

  it('rejects a role that does not own the step', async () => {
    // BR-11: the Process Engineer gets the business rule, not a generic 403.
    const pe = await request(app.getHttpServer())
      .post(`/steps/${stepIds.CUTTING}/start`)
      .set('Authorization', 'Bearer pe-token')
      .expect(409);
    expect(pe.body.brId).toBe('BR-11');
    // Operator on a planner step.
    await request(app.getHttpServer())
      .post(`/steps/${stepIds.BOM_ALLOCATE}/start`)
      .set('Authorization', 'Bearer operator-token')
      .expect(403);
    expect(await statusOf('BOM_ALLOCATE')).toBe('READY');
  });

  it('lets only one of several simultaneous Start clicks win and starts production once', async () => {
    await prisma.stepInstance.update({
      where: { id: stepIds.BOM_ALLOCATE },
      data: { status: 'DONE', completedAt: new Date() },
    });
    await prisma.stepInstance.update({
      where: { id: stepIds.CUTTING },
      data: { status: 'READY' },
    });

    const server = app.getHttpServer();
    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(server)
          .post(`/steps/${stepIds.CUTTING}/start`)
          .set('Authorization', 'Bearer operator-token'),
      ),
    );

    expect(responses.map((r) => r.status).sort()).toEqual([200, 409, 409, 409, 409]);
    expect(await statusOf('CUTTING')).toBe('IN_PROGRESS');
    expect(
      (await prisma.productionOrder.findUniqueOrThrow({ where: { id: orderId } })).status,
    ).toBe('IN_PRODUCTION');
    // BR-16: one audit row per real change, none for the losing requests.
    const audits = await prisma.auditLog.groupBy({
      by: ['action'],
      where: {
        entityId: { in: [stepIds.CUTTING!, orderId] },
        action: { in: ['START_STEP', 'START_PRODUCTION'] },
      },
      _count: true,
    });
    expect(Object.fromEntries(audits.map((a) => [a.action, a._count]))).toEqual({
      START_STEP: 1,
      START_PRODUCTION: 1,
    });
  });

  it("shows the operator only their station's steps", async () => {
    const response = await request(app.getHttpServer())
      .get('/worklist')
      .set('Authorization', 'Bearer operator-token')
      .expect(200);

    const mine = response.body.filter((item: { orderId: string }) => item.orderId === orderId);
    expect(mine.map((item: { stepCode: string }) => item.stepCode)).toEqual(['CUTTING']);
    expect(
      response.body.every((item: { stationType: string }) => item.stationType === 'CUTTING'),
    ).toBe(true);
  });
});
