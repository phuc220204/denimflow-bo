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
  'Bearer operator-token': { id: '00000000-0000-0000-0000-000000000005', role: 'STATION_OPERATOR' },
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

// A random UUID that matches no row; guards run before the handler, so it is never looked up
// on a 401/403. Requests that pass the guard send an invalid body and stop at Zod (422), so the
// test writes nothing to the database.
const anyId = '11111111-1111-4111-8111-111111111111';

describe('Role guards (FR-01)', () => {
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

  describe('users', () => {
    it('FR-01: requires a login (401)', async () => {
      await http().get('/users').expect(401);
      await http().post('/users').send({}).expect(401);
      await http().patch(`/users/${anyId}/status`).send({}).expect(401);
      await http().patch(`/users/${anyId}/assignment`).send({}).expect(401);
    });

    it('FR-01: refuses every role except Admin (403)', async () => {
      for (const token of ['Bearer pe-token', 'Bearer planner-token', 'Bearer operator-token']) {
        await http().get('/users').set('Authorization', token).expect(403);
        await http().post('/users').set('Authorization', token).send({}).expect(403);
        await http()
          .patch(`/users/${anyId}/status`)
          .set('Authorization', token)
          .send({})
          .expect(403);
        await http()
          .patch(`/users/${anyId}/assignment`)
          .set('Authorization', token)
          .send({})
          .expect(403);
      }
    });

    it('FR-01: lets the Admin through', async () => {
      await http().get('/users').set('Authorization', 'Bearer admin-token').expect(200);
      await http().post('/users').set('Authorization', 'Bearer admin-token').send({}).expect(422);
    });
  });

  describe('catalog', () => {
    const writes: { method: 'post' | 'put' | 'delete'; path: string }[] = [
      { method: 'post', path: '/catalog/stations' },
      { method: 'put', path: `/catalog/stations/${anyId}` },
      { method: 'delete', path: `/catalog/stations/${anyId}` },
      { method: 'post', path: '/catalog/styles' },
      { method: 'put', path: `/catalog/styles/${anyId}` },
      { method: 'delete', path: `/catalog/styles/${anyId}` },
      { method: 'post', path: '/catalog/fabric-types' },
      { method: 'put', path: `/catalog/fabric-types/${anyId}` },
      { method: 'delete', path: `/catalog/fabric-types/${anyId}` },
      { method: 'post', path: '/catalog/color-options' },
      { method: 'put', path: `/catalog/color-options/${anyId}` },
      { method: 'delete', path: `/catalog/color-options/${anyId}` },
      { method: 'post', path: '/catalog/wash-types' },
      { method: 'put', path: `/catalog/wash-types/${anyId}` },
      { method: 'delete', path: `/catalog/wash-types/${anyId}` },
      { method: 'post', path: '/catalog/matrix/toggle' },
    ];
    const qcProfilePath = `/catalog/styles/${anyId}/qc-profiles/FULL_PROCESS`;

    it('FR-02: requires a login for reads and writes (401)', async () => {
      await http().get('/catalog/stations').expect(401);
      await http().get(`/catalog/styles/${anyId}/qc-profiles`).expect(401);
      for (const { method, path } of writes) {
        await http()[method](path).send({}).expect(401);
      }
      await http().put(qcProfilePath).send({}).expect(401);
    });

    it('FR-02: any active user may read master data', async () => {
      await http()
        .get('/catalog/stations')
        .set('Authorization', 'Bearer operator-token')
        .expect(200);
    });

    it('FR-02: refuses master data writes from non-Admin roles (403)', async () => {
      for (const token of ['Bearer pe-token', 'Bearer planner-token', 'Bearer operator-token']) {
        for (const { method, path } of writes) {
          await http()[method](path).set('Authorization', token).send({}).expect(403);
        }
      }
    });

    it('FR-02: lets the Admin write master data', async () => {
      await http()
        .post('/catalog/stations')
        .set('Authorization', 'Bearer admin-token')
        .send({})
        .expect(422);
    });

    it('FR-28: QC Profile edits are limited to Admin and Process Engineer', async () => {
      for (const token of ['Bearer planner-token', 'Bearer operator-token']) {
        await http().put(qcProfilePath).set('Authorization', token).send({}).expect(403);
      }
      for (const token of ['Bearer admin-token', 'Bearer pe-token']) {
        await http().put(qcProfilePath).set('Authorization', token).send({}).expect(422);
      }
    });
  });
});
