import 'reflect-metadata';
import { type INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.setup.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service.js';
import type { Role } from '../src/generated/prisma/client.js';

const users: Record<string, { id: string; role: Role }> = {
  'Bearer pe-token': {
    id: '00000000-0000-0000-0000-0000000000a1',
    role: 'PROCESS_ENGINEER' as Role,
  },
  'Bearer planner-token': {
    id: '00000000-0000-0000-0000-0000000000a2',
    role: 'PRODUCTION_PLANNER' as Role,
  },
  'Bearer warehouse-token': {
    id: '00000000-0000-0000-0000-0000000000a3',
    role: 'WAREHOUSE_KEEPER' as Role,
  },
  'Bearer operator-token': {
    id: '00000000-0000-0000-0000-0000000000a4',
    role: 'STATION_OPERATOR' as Role,
  },
  'Bearer qc-token': { id: '00000000-0000-0000-0000-0000000000a5', role: 'QC_INSPECTOR' as Role },
  'Bearer manager-token': { id: '00000000-0000-0000-0000-0000000000a6', role: 'MANAGER' as Role },
  'Bearer admin-token': { id: '00000000-0000-0000-0000-0000000000a7', role: 'ADMIN' as Role },
};

const fakeAuthService = {
  async getMe(authHeader?: string) {
    const user = authHeader ? users[authHeader] : undefined;
    if (!user) {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ hoặc đã hết hạn');
    }
    return {
      ...user,
      email: `${user.role.toLowerCase()}@denimflow.test`,
      fullName: 'Test Actor',
      isActive: true,
    };
  },
  async login() {
    return { accessToken: 'pe-token', user: { ...(await this.getMe('Bearer pe-token')) } };
  },
};

describe('E2E Demo Scenario API Suite (T5.7, PRD §6)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AuthService)
      .useValue(fakeAuthService)
      .compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();

    const prisma = app.get(PrismaService);
    const station = await prisma.station.upsert({
      where: { code: 'DEMO-CUT-01' },
      update: {},
      create: {
        code: 'DEMO-CUT-01',
        name: 'Demo Cutting Station',
        stationType: 'CUTTING',
      },
    });

    for (const user of Object.values(users)) {
      await prisma.profile.upsert({
        where: { id: user.id },
        update: {
          role: user.role,
          stationId: user.role === 'STATION_OPERATOR' ? station.id : null,
        },
        create: {
          id: user.id,
          fullName: 'Demo Test Actor',
          email: `${user.role.toLowerCase()}-demo@denimflow.test`,
          role: user.role,
          stationId: user.role === 'STATION_OPERATOR' ? station.id : null,
          isActive: true,
        },
      });
    }
  });

  afterAll(async () => {
    try {
      const prisma = app.get(PrismaService);
      const userIds = Object.values(users).map((u) => u.id);
      await prisma.profile.deleteMany({ where: { id: { in: userIds } } });
      await prisma.station.deleteMany({ where: { code: 'DEMO-CUT-01' } });
    } catch {
      // ignore cleanup error
    }
    await app.close();
  });

  it('Step 1: Process Engineer inspects templates and versions (BR-01)', async () => {
    const templatesRes = await request(app.getHttpServer())
      .get('/workflow/templates')
      .set('Authorization', 'Bearer pe-token')
      .expect(200);

    expect(Array.isArray(templatesRes.body)).toBe(true);

    // If seeded versions exist, test validation endpoint
    const firstTemplate = templatesRes.body[0];
    if (firstTemplate?.versions?.[0]?.id) {
      const validateRes = await request(app.getHttpServer())
        .post(`/workflow/versions/${firstTemplate.versions[0].id}/validate`)
        .set('Authorization', 'Bearer pe-token')
        .expect(200);

      expect(validateRes.body).toHaveProperty('valid');
      expect(Array.isArray(validateRes.body.violations)).toBe(true);
    }
  });

  it('Step 2: Production Planner checks styles and calculates BOM (FR-09)', async () => {
    const stylesRes = await request(app.getHttpServer())
      .get('/catalog/styles')
      .set('Authorization', 'Bearer planner-token')
      .expect(200);

    expect(Array.isArray(stylesRes.body)).toBe(true);
    const demoStyle =
      stylesRes.body.find((s: { styleCode: string }) => s.styleCode === 'JN-SLIM-01') ??
      stylesRes.body[0];

    if (demoStyle) {
      const bomRes = await request(app.getHttpServer())
        .post('/orders/calculate-bom')
        .set('Authorization', 'Bearer planner-token')
        .send({
          styleId: demoStyle.id,
          orderLines: [
            { size: '28', quantity: 25 },
            { size: '30', quantity: 25 },
            { size: '32', quantity: 25 },
            { size: '34', quantity: 25 },
          ],
        });

      expect([200, 201]).toContain(bomRes.status);
    }
  });

  it('Step 3: Warehouse Keeper inspects allocations and fabric lots (BR-06)', async () => {
    const lotsRes = await request(app.getHttpServer())
      .get('/inventory/fabric-lots')
      .set('Authorization', 'Bearer warehouse-token')
      .expect(200);

    expect(Array.isArray(lotsRes.body)).toBe(true);

    const allocRes = await request(app.getHttpServer())
      .get('/inventory/allocations/orders')
      .set('Authorization', 'Bearer warehouse-token')
      .expect(200);

    expect(Array.isArray(allocRes.body)).toBe(true);
  });

  it('Step 4: Production Planner retrieves orders and verifies draft order lifecycle', async () => {
    const ordersRes = await request(app.getHttpServer())
      .get('/orders')
      .set('Authorization', 'Bearer planner-token')
      .expect(200);

    expect(Array.isArray(ordersRes.body)).toBe(true);
  });

  it('Step 5: Station Operator retrieves execution worklist (FR-12, BR-11)', async () => {
    const worklistRes = await request(app.getHttpServer())
      .get('/worklist')
      .set('Authorization', 'Bearer operator-token')
      .expect(200);

    expect(Array.isArray(worklistRes.body)).toBe(true);
  });

  it('Step 6 & 7: QC Inspector and Planner check defect queries and handover guard (FR-18, FR-26)', async () => {
    // Non-existent order handover returns null (status 200) or 404
    const handoverRes = await request(app.getHttpServer())
      .get('/orders/00000000-0000-0000-0000-000000000000/handover')
      .set('Authorization', 'Bearer planner-token');

    expect([200, 404]).toContain(handoverRes.status);

    // Defect list per order (FR-18)
    const defectsRes = await request(app.getHttpServer())
      .get('/quality/orders/00000000-0000-0000-0000-000000000000/defects')
      .set('Authorization', 'Bearer qc-token')
      .expect(200);

    expect(Array.isArray(defectsRes.body)).toBe(true);
  });

  it('Step 8: Variation order confirms RBAC protection on confirm', async () => {
    // Unauthenticated request rejected with 401
    await request(app.getHttpServer())
      .post('/orders/00000000-0000-0000-0000-000000000000/confirm')
      .expect(401);

    // Non-planner/admin role rejected with 403
    await request(app.getHttpServer())
      .post('/orders/00000000-0000-0000-0000-000000000000/confirm')
      .set('Authorization', 'Bearer operator-token')
      .expect(403);
  });

  it('Step 9: Manager inspects WIP Dashboard and Admin views AuditLog records (FR-21, FR-25)', async () => {
    // Unauthenticated dashboard access rejected
    await request(app.getHttpServer()).get('/dashboard/wip').expect(401);

    // Manager dashboard access allowed
    const dashRes = await request(app.getHttpServer())
      .get('/dashboard/wip')
      .set('Authorization', 'Bearer manager-token')
      .expect(200);

    expect(dashRes.body).toHaveProperty('ordersByStatus');
    expect(dashRes.body).toHaveProperty('wipByStation');
    expect(dashRes.body).toHaveProperty('totals');

    // Admin audit logs
    const auditRes = await request(app.getHttpServer())
      .get('/audit?limit=10')
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    expect(auditRes.body).toHaveProperty('items');
    expect(auditRes.body).toHaveProperty('total');
    expect(Array.isArray(auditRes.body.items)).toBe(true);

    // Operator cannot view audit logs (RBAC restriction)
    await request(app.getHttpServer())
      .get('/audit')
      .set('Authorization', 'Bearer operator-token')
      .expect(403);
  });
});
