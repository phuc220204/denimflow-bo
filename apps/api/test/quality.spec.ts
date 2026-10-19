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

// Seeded demo profiles (src/seed/users.ts) plus a sewing operator and a second inspector.
const SEWER_ID = '00000000-0000-0000-0000-0000000000b5';
const QC2_ID = '00000000-0000-0000-0000-0000000000b6';
const users: Record<string, { id: string; role: string }> = {
  'Bearer planner-token': {
    id: '00000000-0000-0000-0000-000000000003',
    role: 'PRODUCTION_PLANNER',
  },
  'Bearer cutter-token': { id: '00000000-0000-0000-0000-000000000005', role: 'STATION_OPERATOR' },
  'Bearer qc-token': { id: '00000000-0000-0000-0000-000000000006', role: 'QC_INSPECTOR' },
  'Bearer sewer-token': { id: SEWER_ID, role: 'STATION_OPERATOR' },
  'Bearer qc2-token': { id: QC2_ID, role: 'QC_INSPECTOR' },
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

describe('QC inspection (T5.1)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let orderId: string;
  let orderNumber: string;
  let stepIds: Record<string, string>;
  let bundleId: string;

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
    const [sewingStation, qcStation] = await Promise.all([
      prisma.station.findUniqueOrThrow({ where: { code: 'SEW-01' } }),
      prisma.station.findUniqueOrThrow({ where: { code: 'QC-01' } }),
    ]);
    for (const [id, role, stationId] of [
      [SEWER_ID, 'STATION_OPERATOR', sewingStation.id],
      [QC2_ID, 'QC_INSPECTOR', qcStation.id],
    ] as const) {
      await prisma.profile.upsert({
        where: { id },
        update: {},
        create: {
          id,
          email: `${id}@denimflow.test`,
          fullName: role,
          role,
          stationId,
          isActive: true,
        },
      });
    }

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AuthService)
      .useValue(fakeAuthService)
      .compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();

    const [style, fabric, color] = await Promise.all([
      prisma.style.findUniqueOrThrow({ where: { styleCode: DEMO_STYLE_CODE } }),
      prisma.fabricType.findUniqueOrThrow({ where: { code: 'DN-12-RIGID' } }),
      prisma.colorOption.findUniqueOrThrow({ where: { code: 'CLR-INDIGO' } }),
    ]);
    orderNumber = `T51-${randomUUID().slice(0, 8)}`;
    const order = await prisma.productionOrder.create({
      data: {
        orderNumber,
        styleId: style.id,
        fabricTypeId: fabric.id,
        colorId: color.id,
        dueDate: new Date('2026-12-31'),
        createdBy: users['Bearer planner-token']!.id,
        sizeLines: { create: [{ size: '30', plannedQty: 50 }] },
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

    // Planner steps are out of scope: mark them done, then cut 50 and sew them.
    await prisma.stepInstance.updateMany({
      where: { id: { in: [stepIds.FABRIC_COLOR_SELECT!, stepIds.BOM_ALLOCATE!] } },
      data: { status: 'DONE', completedAt: new Date() },
    });
    await prisma.stepInstance.update({ where: { id: stepIds.CUTTING }, data: { status: 'READY' } });
    await post(`/steps/${stepIds.CUTTING}/start`, 'cutter-token').expect(200);
    await post(`/steps/${stepIds.CUTTING}/quantities`, 'cutter-token', {
      size: '30',
      qtyGood: 50,
    }).expect(201);
    await post(`/steps/${stepIds.CUTTING}/complete`, 'cutter-token').expect(200);

    const bundle = await prisma.bundle.findFirstOrThrow({ where: { orderId } });
    bundleId = bundle.id;
    await post(`/steps/${stepIds.SEWING}/start`, 'sewer-token').expect(200);
    await post(`/steps/${stepIds.SEWING}/quantities`, 'sewer-token', {
      bundleId,
      qtyGood: 49,
      qtyDefect: 1,
    }).expect(201);
    await post(`/steps/${stepIds.SEWING}/complete`, 'sewer-token').expect(200);
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
  });

  it('shows the inspector production steps waiting for QC (R-25)', async () => {
    expect((await stepRow('SEWING')).status).toBe('WAITING_QC');
    const response = await request(app.getHttpServer())
      .get('/worklist')
      .set('Authorization', 'Bearer qc-token')
      .expect(200);
    const mine = response.body.filter((item: { orderId: string }) => item.orderId === orderId);
    expect(mine.map((item: { stepCode: string }) => item.stepCode)).toContain('SEWING');
  });

  it('BR-19 proposes from the order profile (FULL_PROCESS: shrinkage up to 3 %)', async () => {
    const path = `/steps/${stepIds.SEWING}/qc/evaluate`;
    const fails = await post(path, 'qc-token', { sampleSize: 20, measuredShrinkagePercent: 4 });
    expect(fails.status).toBe(200);
    expect(fails.body).toMatchObject({ profileType: 'FULL_PROCESS', proposedResult: 'REWORK' });

    const passes = await post(path, 'qc-token', { sampleSize: 20, measuredShrinkagePercent: 2 });
    expect(passes.body.proposedResult).toBe('PASS');
  });

  it('BR-19 refuses a PASS outside the profile thresholds', async () => {
    const response = await post(`/steps/${stepIds.SEWING}/qc/inspections`, 'qc-token', {
      sampleSize: 20,
      measuredShrinkagePercent: 4,
      result: 'PASS',
    }).expect(409);
    expect(response.body.brId).toBe('BR-19');
  });

  it('does not record REWORK or REJECT yet (T5.2)', async () => {
    await post(`/steps/${stepIds.SEWING}/qc/inspections`, 'qc-token', {
      sampleSize: 20,
      result: 'REWORK',
    }).expect(409);
  });

  it('BR-11 refuses an inspector who worked the step', async () => {
    // Simulates a role change: the second inspector had started SEWING.
    await prisma.stepInstance.update({
      where: { id: stepIds.SEWING },
      data: { performedBy: QC2_ID },
    });
    try {
      const response = await post(`/steps/${stepIds.SEWING}/qc/inspections`, 'qc2-token', {
        sampleSize: 20,
        result: 'PASS',
      }).expect(409);
      expect(response.body.brId).toBe('BR-11');
    } finally {
      await prisma.stepInstance.update({
        where: { id: stepIds.SEWING },
        data: { performedBy: SEWER_ID },
      });
    }
  });

  it('rejects a defect on a bundle of another order', async () => {
    await post(`/steps/${stepIds.SEWING}/qc/inspections`, 'qc-token', {
      sampleSize: 20,
      result: 'PASS',
      defects: [{ defectType: 'Đường may lỗi', qty: 1, bundleId: randomUUID() }],
    }).expect(400);
  });

  it('a PASS completes the step, keeps the profile and opens the next step', async () => {
    const order = await prisma.productionOrder.findUniqueOrThrow({ where: { id: orderId } });
    const response = await post(`/steps/${stepIds.SEWING}/qc/inspections`, 'qc-token', {
      sampleSize: 20,
      measuredShrinkagePercent: 2,
      measuredColorFadingLevel: 1,
      result: 'PASS',
      defects: [{ defectType: 'Đường may lỗi', qty: 1, bundleId }],
    }).expect(201);

    expect(response.body).toMatchObject({
      stepStatus: 'DONE',
      newlyReadyStepCodes: ['CLEAN_WASH'],
    });
    expect(response.body.inspection).toMatchObject({
      qcProfileId: order.qcProfileId,
      proposedResult: 'PASS',
      result: 'PASS',
      measuredShrinkagePercent: 2,
    });
    expect(response.body.inspection.defects[0]).toMatchObject({
      qty: 1,
      bundleCode: `${orderNumber}-B001`,
    });
    const sewing = await stepRow('SEWING');
    expect(sewing.status).toBe('DONE');
    expect(sewing.completedBy).toBe(SEWER_ID);
  });

  it('R-25: QC records cannot be updated', async () => {
    const inspection = await prisma.qcInspection.findFirstOrThrow({
      where: { stepInstanceId: stepIds.SEWING },
    });
    await expect(
      prisma.qcInspection.update({ where: { id: inspection.id }, data: { notes: 'sửa' } }),
    ).rejects.toThrow(/R-25/);
  });

  it('a QC-type step is completed only through its inspection', async () => {
    await prisma.stepInstance.update({
      where: { id: stepIds.FINAL_QC },
      data: { status: 'READY' },
    });
    await post(`/steps/${stepIds.FINAL_QC}/start`, 'qc-token').expect(200);
    await post(`/steps/${stepIds.FINAL_QC}/complete`, 'qc-token').expect(409);

    const response = await post(`/steps/${stepIds.FINAL_QC}/qc/inspections`, 'qc-token', {
      sampleSize: 20,
      measuredShrinkagePercent: 1.5,
      result: 'PASS',
    }).expect(201);
    expect(response.body.stepStatus).toBe('DONE');
    expect((await stepRow('FINAL_QC')).completedBy).toBe(users['Bearer qc-token']!.id);
  });

  it('lists the inspections of a step for any logged-in role', async () => {
    const response = await request(app.getHttpServer())
      .get(`/steps/${stepIds.SEWING}/qc/inspections`)
      .set('Authorization', 'Bearer planner-token')
      .expect(200);
    expect(response.body).toHaveLength(1);
  });
});
