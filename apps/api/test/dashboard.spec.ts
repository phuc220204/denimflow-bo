import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { type INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import type { DashboardStepRowDto, DashboardWipSummaryDto } from '@denimflow/shared';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.setup.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { seedCatalog } from '../src/seed/catalog.js';
import { seedUsers } from '../src/seed/users.js';
import { DEMO_STYLE_CODE, seedWorkflow } from '../src/seed/workflow.js';

// Seeded demo profiles (src/seed/users.ts) plus a sewing operator created below.
const SEWER_ID = '00000000-0000-0000-0000-0000000000b5';
const users: Record<string, { id: string; role: string }> = {
  'Bearer admin-token': { id: '00000000-0000-0000-0000-000000000001', role: 'ADMIN' },
  'Bearer engineer-token': { id: '00000000-0000-0000-0000-000000000002', role: 'PROCESS_ENGINEER' },
  'Bearer planner-token': {
    id: '00000000-0000-0000-0000-000000000003',
    role: 'PRODUCTION_PLANNER',
  },
  'Bearer warehouse-token': {
    id: '00000000-0000-0000-0000-000000000004',
    role: 'WAREHOUSE_KEEPER',
  },
  'Bearer cutter-token': { id: '00000000-0000-0000-0000-000000000005', role: 'STATION_OPERATOR' },
  'Bearer qc-token': { id: '00000000-0000-0000-0000-000000000006', role: 'QC_INSPECTOR' },
  'Bearer manager-token': { id: '00000000-0000-0000-0000-000000000007', role: 'MANAGER' },
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

type Numbers = Omit<DashboardStepRowDto, 'stepCode' | 'stepName' | 'seq' | 'stationType'>;
const NUMBER_FIELDS = [
  'openOrderCount',
  'wipBundleCount',
  'wipQty',
  'qtyIn',
  'qtyGood',
  'qtyDefect',
  'reworkCount',
] as const;

// The test database is shared with other test files, so every check compares against a baseline
// taken before this file creates its order.
describe('Dashboard WIP (T5.5, FR-21)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let baseline: DashboardWipSummaryDto;
  let orderId: string;
  let orderNumber: string;
  let stepIds: Record<string, string>;

  const post = (path: string, token: string, body: object = {}) =>
    request(app.getHttpServer()).post(path).set('Authorization', `Bearer ${token}`).send(body);

  const summary = async (token = 'manager-token'): Promise<DashboardWipSummaryDto> => {
    const response = await request(app.getHttpServer())
      .get('/dashboard/wip')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return response.body;
  };

  const stepNumbers = (
    data: DashboardWipSummaryDto,
    code: string,
  ): Omit<Numbers, 'tracksQuantities'> => {
    const row = data.steps.find((step) => step.stepCode === code);
    return Object.fromEntries(NUMBER_FIELDS.map((field) => [field, row?.[field] ?? 0])) as Omit<
      Numbers,
      'tracksQuantities'
    >;
  };

  // What changed at one step since the baseline.
  const stepDelta = (data: DashboardWipSummaryDto, code: string) => {
    const now = stepNumbers(data, code);
    const before = stepNumbers(baseline, code);
    return Object.fromEntries(NUMBER_FIELDS.map((field) => [field, now[field] - before[field]]));
  };

  const totalsDelta = (data: DashboardWipSummaryDto) =>
    Object.fromEntries(
      Object.entries(data.totals).map(([key, value]) => [
        key,
        value - baseline.totals[key as keyof DashboardWipSummaryDto['totals']],
      ]),
    );

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
        email: 'dashboard-sewer@denimflow.test',
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
    await app.init();

    baseline = await summary();
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
  });

  it('FR-01: answers 401 without a valid token', async () => {
    await request(app.getHttpServer()).get('/dashboard/wip').expect(401);
    await request(app.getHttpServer())
      .get('/dashboard/wip')
      .set('Authorization', 'Bearer unknown-token')
      .expect(401);
  });

  it('FR-21: answers 403 to Warehouse Keeper, Station Operator and QC Inspector (PRD §4)', async () => {
    for (const token of ['warehouse-token', 'cutter-token', 'qc-token']) {
      await request(app.getHttpServer())
        .get('/dashboard/wip')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    }
  });

  it('FR-21: Manager, Admin, Process Engineer and Planner see the same numbers', async () => {
    const [manager, ...others] = await Promise.all(
      ['manager-token', 'admin-token', 'engineer-token', 'planner-token'].map((t) => summary(t)),
    );
    for (const data of others) {
      expect(data).toEqual(manager);
    }
  });

  it('counts a new order by status and the pieces cut so far at the open cutting step', async () => {
    const [style, fabric, color] = await Promise.all([
      prisma.style.findUniqueOrThrow({ where: { styleCode: DEMO_STYLE_CODE } }),
      prisma.fabricType.findUniqueOrThrow({ where: { code: 'DN-12-RIGID' } }),
      prisma.colorOption.findUniqueOrThrow({ where: { code: 'CLR-INDIGO' } }),
    ]);
    orderNumber = `T55-${randomUUID().slice(0, 8)}`;
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
    expect((await summary()).ordersByStatus.DRAFT - baseline.ordersByStatus.DRAFT).toBe(1);

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
    await prisma.stepInstance.update({ where: { id: stepIds.CUTTING }, data: { status: 'READY' } });
    await post(`/steps/${stepIds.CUTTING}/start`, 'cutter-token').expect(200);
    await post(`/steps/${stepIds.CUTTING}/quantities`, 'cutter-token', {
      size: '30',
      qtyGood: 98,
      qtyDefect: 2,
    }).expect(201);

    const data = await summary();
    expect(data.ordersByStatus.IN_PRODUCTION - baseline.ordersByStatus.IN_PRODUCTION).toBe(1);
    expect(stepDelta(data, 'CUTTING')).toEqual({
      openOrderCount: 1,
      wipBundleCount: 0,
      wipQty: 100,
      qtyIn: 100,
      qtyGood: 98,
      qtyDefect: 2,
      reworkCount: 0,
    });
    expect(totalsDelta(data)).toMatchObject({ totalOrders: 1, activeOrders: 1, totalQtyDefect: 2 });
  });

  it('R-26: bundles from cutting sit at sewing until it is done; reversal rows net out', async () => {
    await post(`/steps/${stepIds.CUTTING}/complete`, 'cutter-token').expect(200);
    await post(`/steps/${stepIds.SEWING}/start`, 'sewer-token').expect(200);
    const [b1, b2] = await prisma.bundle.findMany({
      where: { orderId },
      orderBy: { bundleCode: 'asc' },
    });
    expect([b1!.qty, b2!.qty]).toEqual([50, 48]);

    const path = `/steps/${stepIds.SEWING}/quantities`;
    await post(path, 'sewer-token', { bundleId: b1!.id, qtyGood: 45, qtyDefect: 5 }).expect(201);
    const typo = await post(path, 'sewer-token', { bundleId: b2!.id, qtyGood: 40 }).expect(201);
    await post(`${path}/${typo.body.id}/reverse`, 'sewer-token', { reason: 'Gõ nhầm' }).expect(201);
    await post(path, 'sewer-token', { bundleId: b2!.id, qtyGood: 47, qtyDefect: 1 }).expect(201);

    const data = await summary();
    expect(stepDelta(data, 'CUTTING')).toMatchObject({ openOrderCount: 0, wipQty: 0 });
    expect(stepDelta(data, 'SEWING')).toEqual({
      openOrderCount: 1,
      wipBundleCount: 2,
      wipQty: 98,
      qtyIn: 98,
      qtyGood: 92,
      qtyDefect: 6,
      reworkCount: 0,
    });
    expect(totalsDelta(data)).toMatchObject({ wipBundleCount: 2, wipQty: 98, totalQtyDefect: 8 });

    // Numbers match the database: the step totals equal the net sums of its entries.
    const entries = await prisma.stepQuantityEntry.aggregate({
      where: { stepInstanceId: stepIds.SEWING },
      _sum: { qtyGood: true, qtyDefect: true },
    });
    expect(entries._sum).toEqual({ qtyGood: 92, qtyDefect: 6 });
  });

  it('R-26: a step waiting for QC keeps its bundles and lists the order as waiting', async () => {
    const completed = await post(`/steps/${stepIds.SEWING}/complete`, 'sewer-token').expect(200);
    expect(completed.body.status).toBe('WAITING_QC');

    const data = await summary();
    expect(stepDelta(data, 'SEWING')).toMatchObject({ openOrderCount: 1, wipBundleCount: 2 });
    expect(totalsDelta(data)).toMatchObject({ waitingQcOrderCount: 1 });
    expect(data.waitingQc).toContainEqual(
      expect.objectContaining({
        orderId,
        orderNumber,
        styleCode: DEMO_STYLE_CODE,
        stepCode: 'SEWING',
        status: 'WAITING_QC',
      }),
    );
  });

  it('R-26: the next open step takes the good pieces per bundle, skipped steps passed through', async () => {
    // The QC decision is T5.1; here a PASS is written directly: SEWING done, next step open.
    await prisma.stepInstance.update({
      where: { id: stepIds.SEWING },
      data: { status: 'DONE', completedAt: new Date() },
    });
    const next = await prisma.stepInstance.findFirstOrThrow({
      where: { instance: { orderId }, status: 'PENDING', stepDefinition: { seq: { gt: 8 } } },
      include: { stepDefinition: true },
      orderBy: { stepDefinition: { seq: 'asc' } },
    });
    // No wash type and no dyeing on this order: DYEING and EFFECT_WASH were skipped at Confirm.
    expect(next.stepDefinition.code).toBe('CLEAN_WASH');
    await prisma.stepInstance.update({ where: { id: next.id }, data: { status: 'READY' } });

    const data = await summary();
    expect(stepDelta(data, 'SEWING')).toMatchObject({ openOrderCount: 0, wipBundleCount: 0 });
    expect(stepDelta(data, 'CLEAN_WASH')).toMatchObject({
      openOrderCount: 1,
      wipBundleCount: 2,
      wipQty: 92,
    });
    expect(data.waitingQc.some((item) => item.orderId === orderId)).toBe(false);
  });
});
