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
import { ExecutionRepository } from '../src/modules/execution/execution.repository.js';
import { seedCatalog } from '../src/seed/catalog.js';
import { seedUsers } from '../src/seed/users.js';
import { DEMO_STYLE_CODE, seedWorkflow } from '../src/seed/workflow.js';

// Seeded demo profiles (src/seed/users.ts) plus a sewing operator created below.
const SEWER_ID = '00000000-0000-0000-0000-0000000000a5';
const users: Record<string, { id: string; role: string }> = {
  'Bearer planner-token': {
    id: '00000000-0000-0000-0000-000000000003',
    role: 'PRODUCTION_PLANNER',
  },
  'Bearer cutter-token': { id: '00000000-0000-0000-0000-000000000005', role: 'STATION_OPERATOR' },
  'Bearer sewer-token': { id: SEWER_ID, role: 'STATION_OPERATOR' },
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

describe('Quantity entry and conservation (T4.3)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let orderId: string;
  let orderNumber: string;
  let stepIds: Record<string, string>;

  const post = (path: string, token: string, body: object = {}) =>
    request(app.getHttpServer()).post(path).set('Authorization', `Bearer ${token}`).send(body);

  const stepRow = (code: string) =>
    prisma.stepInstance.findUniqueOrThrow({ where: { id: stepIds[code] } });

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    await seedCatalog(prisma);
    await seedUsers(prisma, null, '');
    await seedWorkflow(prisma);
    const sewingStation = await prisma.station.findUniqueOrThrow({ where: { code: 'SEW-01' } });
    await prisma.profile.upsert({
      where: { id: SEWER_ID },
      update: { stationId: sewingStation.id },
      create: {
        id: SEWER_ID,
        email: 'sewer@denimflow.test',
        fullName: 'Sewing Operator',
        role: 'STATION_OPERATOR',
        stationId: sewingStation.id,
        isActive: true,
      },
    });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AuthService)
      .useValue(fakeAuthService)
      .compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    // Listen once so concurrent supertest requests share one server.
    await app.listen(0);

    const [style, fabric, color] = await Promise.all([
      prisma.style.findUniqueOrThrow({ where: { styleCode: DEMO_STYLE_CODE } }),
      prisma.fabricType.findUniqueOrThrow({ where: { code: 'DN-12-RIGID' } }),
      prisma.colorOption.findUniqueOrThrow({ where: { code: 'CLR-INDIGO' } }),
    ]);
    orderNumber = `T43-${randomUUID().slice(0, 8)}`;
    const order = await prisma.productionOrder.create({
      data: {
        orderNumber,
        styleId: style.id,
        fabricTypeId: fabric.id,
        colorId: color.id,
        dueDate: new Date('2026-12-31'),
        createdBy: users['Bearer planner-token']!.id,
        sizeLines: { create: [{ size: '30', plannedQty: 100 }] },
      },
    });
    orderId = order.id;
    await post(`/orders/${orderId}/confirm`, 'planner-token').expect((res) =>
      expect(res.status).toBeLessThan(300),
    );

    const steps = await prisma.stepInstance.findMany({
      where: { instance: { orderId } },
      include: { stepDefinition: true },
    });
    stepIds = Object.fromEntries(steps.map((s) => [s.stepDefinition.code, s.id]));

    // Planner steps are out of scope here: mark them done and open cutting.
    await prisma.stepInstance.updateMany({
      where: { id: { in: [stepIds.FABRIC_COLOR_SELECT!, stepIds.BOM_ALLOCATE!] } },
      data: { status: 'DONE', completedAt: new Date() },
    });
    await prisma.stepInstance.update({
      where: { id: stepIds.CUTTING },
      data: { status: 'READY' },
    });
    await post(`/steps/${stepIds.CUTTING}/start`, 'cutter-token').expect(200);
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
  });

  it('BR-07 rejects a cut above plan + 5 % (style default)', async () => {
    const response = await post(`/steps/${stepIds.CUTTING}/quantities`, 'cutter-token', {
      size: '30',
      qtyGood: 106,
    }).expect(409);
    expect(response.body.brId).toBe('BR-07');
  });

  it('cancels a typo with a reversal row and keeps the history (R-22)', async () => {
    const path = `/steps/${stepIds.CUTTING}/quantities`;
    await post(path, 'cutter-token', { size: '30', qtyGood: 60 }).expect(201);
    const typo = await post(path, 'cutter-token', { size: '30', qtyGood: 41 }).expect(201);
    await post(`${path}/${typo.body.id}/reverse`, 'cutter-token', { reason: 'Gõ nhầm' }).expect(
      201,
    );
    await post(`${path}/${typo.body.id}/reverse`, 'cutter-token', { reason: 'Lần hai' }).expect(
      409,
    );
    await post(path, 'cutter-token', { size: '30', qtyGood: 40 }).expect(201);

    const panel = await request(app.getHttpServer())
      .get(path)
      .set('Authorization', 'Bearer cutter-token')
      .expect(200);
    expect(panel.body).toMatchObject({ mode: 'CUTTING', qtyIn: 100, qtyGood: 100 });
    expect(panel.body.entries.map((e: { qtyGood: number }) => e.qtyGood)).toEqual([
      60, 41, -41, 40,
    ]);
    expect(panel.body.entries[1].isReversed).toBe(true);
  });

  it('R-03: quantity entries cannot be updated', async () => {
    const anyEntry = await prisma.stepQuantityEntry.findFirstOrThrow({
      where: { stepInstanceId: stepIds.CUTTING },
    });
    await expect(
      prisma.stepQuantityEntry.update({ where: { id: anyEntry.id }, data: { qtyGood: 1 } }),
    ).rejects.toThrow(/R-03/);
  });

  it('completing cutting creates bundles of 50 from the good pieces and opens sewing', async () => {
    const completed = await post(`/steps/${stepIds.CUTTING}/complete`, 'cutter-token').expect(200);
    expect(completed.body.newlyReadyStepCodes).toEqual(['SEWING']);

    const bundles = await prisma.bundle.findMany({
      where: { orderId },
      orderBy: { bundleCode: 'asc' },
    });
    expect(bundles.map((b) => [b.bundleCode, b.size, b.qty])).toEqual([
      [`${orderNumber}-B001`, '30', 50],
      [`${orderNumber}-B002`, '30', 50],
    ]);
  });

  it('lets only one of two simultaneous entries take the last pieces of a bundle (BR-08)', async () => {
    await post(`/steps/${stepIds.SEWING}/start`, 'sewer-token').expect(200);
    const bundle = await prisma.bundle.findFirstOrThrow({
      where: { orderId, bundleCode: `${orderNumber}-B001` },
    });

    const responses = await Promise.all(
      [1, 2].map(() =>
        post(`/steps/${stepIds.SEWING}/quantities`, 'sewer-token', {
          bundleId: bundle.id,
          qtyGood: 28,
          qtyDefect: 2,
        }),
      ),
    );

    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(responses.find((r) => r.status === 409)?.body.brId).toBe('BR-08');
    const sewing = await stepRow('SEWING');
    expect([sewing.qtyIn, sewing.qtyGood, sewing.qtyDefect]).toEqual([30, 28, 2]);
  });

  it('lists everyone who worked a step for the BR-11 check at QC (R-23)', async () => {
    const performers = await app
      .get(ExecutionRepository)
      .findStepPerformers(prisma as never, stepIds.SEWING!);
    expect(performers).toEqual({
      performedBy: SEWER_ID,
      completedBy: null,
      quantityEnteredBy: [SEWER_ID],
    });
  });

  it('BR-08 blocks completing sewing until every piece handed over is accounted for', async () => {
    const response = await post(`/steps/${stepIds.SEWING}/complete`, 'sewer-token').expect(409);
    expect(response.body.brId).toBe('BR-08');
    expect((await stepRow('SEWING')).status).toBe('IN_PROGRESS');
  });

  it('rejects quantities from another station or role', async () => {
    await post(`/steps/${stepIds.SEWING}/quantities`, 'cutter-token', {
      bundleId: randomUUID(),
      qtyGood: 1,
    }).expect(403);
    await post(`/steps/${stepIds.SEWING}/quantities`, 'planner-token', {
      bundleId: randomUUID(),
      qtyGood: 1,
    }).expect(403);
  });
});
