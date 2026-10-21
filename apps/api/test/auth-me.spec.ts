import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import { vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.setup.js';
import { APP_CONFIG } from '../src/config/env.schema.js';
import { loadConfig } from '../src/config/load-config.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { seedCatalog } from '../src/seed/catalog.js';
import { seedUsers } from '../src/seed/users.js';

// Seeded demo profile (src/seed/users.ts).
const MANAGER_ID = '00000000-0000-0000-0000-000000000007';
// An Auth user that has no row in `profiles`.
const STRANGER_ID = '00000000-0000-0000-0000-0000000000ff';

// Only Supabase's token check is replaced: the real AuthService still loads the role from `profiles`.
const authUsers: Record<string, string> = {
  'manager-jwt': MANAGER_ID,
  'stranger-jwt': STRANGER_ID,
};
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: async (token: string) =>
        authUsers[token]
          ? { data: { user: { id: authUsers[token] } }, error: null }
          : { data: { user: null }, error: { message: 'invalid JWT' } },
    },
  }),
}));

describe('GET /auth/me (T0.4)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    await seedCatalog(prisma);
    await seedUsers(prisma, null, '');

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APP_CONFIG)
      .useValue({
        ...loadConfig(),
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role',
      })
      .compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
  });

  it('is 401 without a token', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('is 401 with a token Supabase rejects', async () => {
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Bearer forged-jwt')
      .expect(401);
  });

  it('is 401 for an Auth user without a profile', async () => {
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Bearer stranger-jwt')
      .expect(401);
  });

  it('is 200 with the profile and its role for a seeded user', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Bearer manager-jwt')
      .expect(200);

    expect(response.body).toMatchObject({
      id: MANAGER_ID,
      email: 'manager@denimflow.internal',
      role: 'MANAGER',
      isActive: true,
    });
  });
});
