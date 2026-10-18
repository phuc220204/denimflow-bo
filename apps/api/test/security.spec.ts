import 'reflect-metadata';
import { type INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.setup.js';
import { AuthService } from '../src/modules/auth/auth.service.js';

// Stand-in for Supabase token checks: two known tokens, everything else is rejected.
const users: Record<string, { id: string; role: string }> = {
  'Bearer pe-token': { id: '00000000-0000-0000-0000-0000000000a1', role: 'PROCESS_ENGINEER' },
  'Bearer planner-token': {
    id: '00000000-0000-0000-0000-0000000000a2',
    role: 'PRODUCTION_PLANNER',
  },
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

describe('API security hotfix', () => {
  let app: INestApplication;

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
    await app.close();
  });

  describe('workflow routes', () => {
    it('reject requests without a token (401)', async () => {
      await request(app.getHttpServer()).get('/workflow/templates').expect(401);
      await request(app.getHttpServer())
        .post('/workflow/templates')
        .send({ name: 'Hack' })
        .expect(401);
    });

    it('reject a forged local-token (401)', async () => {
      await request(app.getHttpServer())
        .post('/workflow/versions/00000000-0000-0000-0000-000000000000/publish')
        .set('Authorization', 'Bearer local-token-00000000-0000-0000-0000-0000000000a1')
        .expect(401);
    });

    it('let any logged-in role read templates', async () => {
      await request(app.getHttpServer())
        .get('/workflow/templates')
        .set('Authorization', 'Bearer planner-token')
        .expect(200);
    });

    it('allow only the Process Engineer to change templates (403 for others)', async () => {
      await request(app.getHttpServer())
        .post('/workflow/templates')
        .set('Authorization', 'Bearer planner-token')
        .send({ name: 'Not mine' })
        .expect(403);
    });
  });

  describe('catalog read routes', () => {
    it('reject requests without a token (401)', async () => {
      await request(app.getHttpServer()).get('/catalog/stations').expect(401);
      await request(app.getHttpServer()).get('/catalog/matrix').expect(401);
    });

    it('allow any logged-in role', async () => {
      await request(app.getHttpServer())
        .get('/catalog/stations')
        .set('Authorization', 'Bearer planner-token')
        .expect(200);
    });
  });

  describe('invalid input', () => {
    it('returns 422 with field issues instead of 500 (API-local schema)', async () => {
      const response = await request(app.getHttpServer())
        .post('/workflow/templates')
        .set('Authorization', 'Bearer pe-token')
        .send({ name: '' })
        .expect(422);

      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.issues[0].path).toBe('name');
    });

    it('returns 422 for schemas from @denimflow/shared too', async () => {
      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', 'Bearer planner-token')
        .send({})
        .expect(422);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });
});
