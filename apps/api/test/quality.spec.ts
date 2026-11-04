import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { type INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import { EvidenceStorage } from '../src/modules/execution/evidence-storage.js';
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
  'Bearer manager-token': { id: '00000000-0000-0000-0000-000000000007', role: 'MANAGER' },
  'Bearer planner-token': {
    id: '00000000-0000-0000-0000-000000000003',
    role: 'PRODUCTION_PLANNER',
  },
  'Bearer cutter-token': { id: '00000000-0000-0000-0000-000000000005', role: 'STATION_OPERATOR' },
  'Bearer qc-token': { id: '00000000-0000-0000-0000-000000000006', role: 'QC_INSPECTOR' },
  'Bearer sewer-token': { id: SEWER_ID, role: 'STATION_OPERATOR' },
  'Bearer qc2-token': { id: QC2_ID, role: 'QC_INSPECTOR' },
};

const evidenceMetadata = { mimeType: 'application/pdf', sizeBytes: 100 };

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
      .overrideProvider(EvidenceStorage)
      .useValue({
        sign: async () => ({ signedUrl: 'https://storage.example.test/upload' }),
        info: async () => evidenceMetadata,
      })
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

  it('BR-10 rejects REWORK without a target and reason', async () => {
    await post(`/steps/${stepIds.SEWING}/qc/inspections`, 'qc-token', {
      sampleSize: 20,
      result: 'REWORK',
    }).expect(422);
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

  it('BR-15 requires evidence before completing a configured step', async () => {
    // An isolated new DRAFT definition avoids modifying a published workflow (BR-02).
    const template = await prisma.workflowTemplate.create({
      data: { name: `Evidence-${randomUUID()}` },
    });
    const version = await prisma.workflowVersion.create({
      data: { templateId: template.id, versionNo: 1, status: 'DRAFT' },
    });
    const definition = await prisma.stepDefinition.create({
      data: {
        versionId: version.id,
        code: 'EVIDENCE_TEST',
        name: 'Evidence',
        stepType: 'APPROVAL',
        responsibleRole: 'PRODUCTION_PLANNER',
        requiresEvidence: true,
        seq: 1,
      },
    });
    const instance = await prisma.workflowInstance.findUniqueOrThrow({ where: { orderId } });
    const evidenceStep = await prisma.stepInstance.create({
      data: { instanceId: instance.id, stepDefinitionId: definition.id, status: 'IN_PROGRESS' },
    });
    const response = await post(`/steps/${evidenceStep.id}/complete`, 'planner-token').expect(409);
    expect(response.body.brId).toBe('BR-15');
    const base = `/steps/${evidenceStep.id}/evidence`;
    await post(`${base}/upload-url`, 'planner-token', {
      mimeType: 'text/html',
      sizeBytes: 100,
    }).expect(422);
    await post(`${base}/upload-url`, 'planner-token', {
      mimeType: 'application/pdf',
      sizeBytes: 6 * 1024 * 1024,
    }).expect(422);
    const upload = await post(`${base}/upload-url`, 'planner-token', {
      mimeType: 'application/pdf',
      sizeBytes: 100,
    }).expect(201);
    expect(upload.body.filePath).toContain(`orders/${orderId}/evidence/${evidenceStep.id}/`);
    await post(base, 'planner-token', {
      filePath: 'orders/another-order/evidence/file.pdf',
    }).expect(400);
    await post(base, 'cutter-token', { filePath: upload.body.filePath }).expect(403);

    evidenceMetadata.sizeBytes = 6 * 1024 * 1024;
    await post(base, 'planner-token', { filePath: upload.body.filePath }).expect(400);
    evidenceMetadata.sizeBytes = 100;
    evidenceMetadata.mimeType = 'text/html';
    await post(base, 'planner-token', { filePath: upload.body.filePath }).expect(400);
    evidenceMetadata.mimeType = 'application/pdf';
    await post(base, 'planner-token', { filePath: upload.body.filePath }).expect(201);
    const files = await request(app.getHttpServer())
      .get(base)
      .set('Authorization', 'Bearer planner-token')
      .expect(200);
    expect(files.body).toHaveLength(1);
    expect(files.body[0]).toMatchObject({ sizeBytes: 100, mimeType: 'application/pdf' });
    await post(`/steps/${evidenceStep.id}/complete`, 'planner-token').expect(200);
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

  it('BR-10 routes a failed QC once, invalidates its path and preserves quantities', async () => {
    for (const code of ['CLEAN_WASH', 'FINISHING']) {
      await prisma.stepInstance.update({
        where: { id: stepIds[code] },
        data: { status: 'DONE', qtyIn: 49, qtyGood: 49, qtyDefect: 0 },
      });
      await prisma.stepQuantityEntry.create({
        data: {
          stepInstanceId: stepIds[code]!,
          bundleId,
          qtyGood: 49,
          qtyDefect: 0,
          enteredBy: SEWER_ID,
        },
      });
    }

    // The prior test passed FINAL_QC; restore a consistent pre-decision fixture for this cycle.
    await prisma.stepInstance.update({
      where: { id: stepIds.PACK_HANDOVER },
      data: { status: 'PENDING' },
    });
    const targetBefore = await stepRow('FINISHING');
    await prisma.stepInstance.update({ where: { id: targetBefore.id }, data: { status: 'DONE' } });
    await prisma.stepInstance.update({
      where: { id: stepIds.FINAL_QC },
      data: { status: 'IN_PROGRESS' },
    });
    const body = {
      sampleSize: 20,
      result: 'REWORK',
      measuredShrinkagePercent: 4,
      reworkTargetStepId: targetBefore.id,
      reason: 'Sửa độ co',
    };
    const responses = await Promise.all([
      post(`/steps/${stepIds.FINAL_QC}/qc/inspections`, 'qc-token', body),
      post(`/steps/${stepIds.FINAL_QC}/qc/inspections`, 'qc-token', body),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    const target = await stepRow('FINISHING');
    expect(target).toMatchObject({
      status: 'REWORK',
      reworkCount: 1,
      qtyIn: targetBefore.qtyIn,
      qtyGood: targetBefore.qtyGood,
      qtyDefect: targetBefore.qtyDefect,
    });
    expect((await stepRow('FINAL_QC')).status).toBe('PENDING');
    const dashboard = await request(app.getHttpServer())
      .get('/dashboard/wip')
      .set('Authorization', 'Bearer manager-token')
      .expect(200);
    expect(
      dashboard.body.waitingQc.filter((item: { orderId: string }) => item.orderId === orderId),
    ).toHaveLength(0);
    const open = await prisma.stepInstance.findMany({
      where: {
        instance: { orderId },
        status: { in: ['READY', 'REWORK', 'IN_PROGRESS', 'WAITING_QC'] },
      },
    });
    expect(open.map((step) => step.id)).toEqual([stepIds.FINISHING]);

    const audit = await prisma.auditLog.findFirst({
      where: { entityId: target.id, action: 'QC_REWORK' },
    });
    expect(audit).not.toBeNull();
  });

  it('BR-10 refuses a target outside the published REWORK transitions', async () => {
    await prisma.stepInstance.update({
      where: { id: stepIds.FINAL_QC },
      data: { status: 'IN_PROGRESS' },
    });
    await post(`/steps/${stepIds.FINAL_QC}/qc/inspections`, 'qc-token', {
      sampleSize: 20,
      result: 'REWORK',
      reworkTargetStepId: stepIds.CUTTING,
      reason: 'Sai tuyến',
    }).expect(409);
  });

  it('BR-10 flags the instance for the Planner at the loop limit, without another loop', async () => {
    await prisma.stepInstance.update({
      where: { id: stepIds.FINISHING },
      data: { status: 'DONE', reworkCount: 2 },
    });
    const response = await post(`/steps/${stepIds.FINAL_QC}/qc/inspections`, 'qc-token', {
      sampleSize: 20,
      result: 'REWORK',
      reworkTargetStepId: stepIds.FINISHING,
      reason: 'Vẫn lỗi',
    }).expect(201);
    expect(response.body.requiresPlannerReview).toBe(true);
    expect((await stepRow('FINISHING')).status).toBe('DONE');
    const instance = await prisma.workflowInstance.findUniqueOrThrow({ where: { orderId } });
    expect(instance).toMatchObject({ requiresPlannerReview: true, plannerReviewReason: 'Vẫn lỗi' });
    const worklist = await request(app.getHttpServer())
      .get('/worklist')
      .set('Authorization', 'Bearer planner-token')
      .expect(200);
    expect(
      worklist.body.find((s: { id: string }) => s.id === stepIds.FINAL_QC).requiresPlannerReview,
    ).toBe(true);
    await post(`/steps/${stepIds.FINAL_QC}/qc/inspections`, 'qc-token', {
      sampleSize: 20,
      result: 'PASS',
    }).expect(409);
  });

  it('lists the inspections of a step for any logged-in role', async () => {
    const response = await request(app.getHttpServer())
      .get(`/steps/${stepIds.SEWING}/qc/inspections`)
      .set('Authorization', 'Bearer planner-token')
      .expect(200);
    expect(response.body).toHaveLength(1);
  });
  it('FR-18 lists persisted inspection defects with their bundle and inspector', async () => {
    await request(app.getHttpServer()).get(`/quality/orders/${orderId}/defects`).expect(401);
    const response = await request(app.getHttpServer())
      .get(`/quality/orders/${orderId}/defects`)
      .set('Authorization', 'Bearer planner-token')
      .expect(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      stepCode: 'SEWING',
      bundleId,
      bundleCode: `${orderNumber}-B001`,
      defectType: 'Đường may lỗi',
      qty: 1,
    });
    expect(response.body[0].inspectionId).toBeDefined();
    expect(response.body[0].inspectorName).toBeTruthy();
    await request(app.getHttpServer())
      .get('/quality/orders/not-a-uuid/defects')
      .set('Authorization', 'Bearer planner-token')
      .expect(400);
  });
});
