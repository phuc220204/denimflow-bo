import 'reflect-metadata';
import { type INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.setup.js';
import { AuthService } from '../src/modules/auth/auth.service.js';

// Stand-in for Supabase token checks: one token per role, everything else is rejected (401).
const users: Record<string, { id: string; role: string }> = {
  'Bearer admin-token': { id: '00000000-0000-0000-0000-000000000001', role: 'ADMIN' },
  'Bearer pe-token': { id: '00000000-0000-0000-0000-000000000002', role: 'PROCESS_ENGINEER' },
  'Bearer planner-token': {
    id: '00000000-0000-0000-0000-000000000003',
    role: 'PRODUCTION_PLANNER',
  },
  'Bearer keeper-token': { id: '00000000-0000-0000-0000-000000000004', role: 'WAREHOUSE_KEEPER' },
  'Bearer operator-token': { id: '00000000-0000-0000-0000-000000000005', role: 'STATION_OPERATOR' },
  'Bearer qc-token': { id: '00000000-0000-0000-0000-000000000006', role: 'QC_INSPECTOR' },
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

// Guards run before the handler, so this id is never looked up on a 401/403. Requests that pass
// the guard send an invalid body and stop at Zod (422), so the test writes nothing.
const anyId = '11111111-1111-4111-8111-111111111111';

describe('Role guards: order and inventory (FR-01)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AuthService)
      .useValue(fakeAuthService)
      .compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('orders', () => {
    const writes: { method: 'post' | 'patch'; path: string }[] = [
      { method: 'post', path: '/orders' },
      { method: 'patch', path: `/orders/${anyId}` },
      { method: 'patch', path: `/orders/${anyId}/fabric-color` },
      { method: 'post', path: `/orders/${anyId}/bom/calculate` },
      { method: 'post', path: `/orders/${anyId}/acknowledgement` },
      { method: 'post', path: `/orders/${anyId}/confirm` },
    ];

    it('FR-01: requires a login for reads and writes (401)', async () => {
      await http().get('/orders').expect(401);
      await http().get(`/orders/${anyId}`).expect(401);
      await http().get(`/orders/${anyId}/bom`).expect(401);
      for (const { method, path } of writes) {
        await http()[method](path).send({}).expect(401);
      }
    });

    it('FR-01: any active user may read orders', async () => {
      await http().get('/orders').set('Authorization', 'Bearer operator-token').expect(200);
    });

    it('FR-01: refuses order writes from roles other than Planner, Admin, Manager (403)', async () => {
      for (const token of [
        'Bearer pe-token',
        'Bearer keeper-token',
        'Bearer operator-token',
        'Bearer qc-token',
      ]) {
        for (const { method, path } of writes) {
          await http()[method](path).set('Authorization', token).send({}).expect(403);
        }
      }
    });

    it('FR-01: lets Planner, Admin and Manager create orders', async () => {
      for (const token of ['Bearer planner-token', 'Bearer admin-token', 'Bearer manager-token']) {
        await http().post('/orders').set('Authorization', token).send({}).expect(422);
      }
    });
  });

  describe('inventory', () => {
    it('FR-01: requires a login for reads and writes (401)', async () => {
      await http().get('/inventory/fabric-lots').expect(401);
      await http().get('/inventory/requests').expect(401);
      await http().get('/inventory/allocations/orders').expect(401);
      await http().get(`/inventory/cutting-gate/${anyId}`).expect(401);
      await http().post('/inventory/allocate').send({}).expect(401);
    });

    it('FR-01: any active user may read stock', async () => {
      await http()
        .get('/inventory/fabric-lots')
        .set('Authorization', 'Bearer operator-token')
        .expect(200);
    });

    it('FR-01: refuses fabric allocation from roles other than Keeper, Admin, Manager (403)', async () => {
      for (const token of [
        'Bearer pe-token',
        'Bearer planner-token',
        'Bearer operator-token',
        'Bearer qc-token',
      ]) {
        await http().post('/inventory/allocate').set('Authorization', token).send({}).expect(403);
      }
    });

    it('FR-01: lets Warehouse Keeper, Admin and Manager allocate fabric', async () => {
      for (const token of ['Bearer keeper-token', 'Bearer admin-token', 'Bearer manager-token']) {
        await http().post('/inventory/allocate').set('Authorization', token).send({}).expect(422);
      }
    });
  });
});
