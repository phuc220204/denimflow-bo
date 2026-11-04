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

// Tokens map to the seeded demo profiles (src/seed/users.ts).
const ADMIN_ID = '00000000-0000-0000-0000-000000000001';
const PLANNER_ID = '00000000-0000-0000-0000-000000000003';
const users: Record<string, { id: string; role: string }> = {
  'Bearer admin-token': { id: ADMIN_ID, role: 'ADMIN' },
  'Bearer manager-token': { id: '00000000-0000-0000-0000-000000000007', role: 'MANAGER' },
  'Bearer planner-token': { id: PLANNER_ID, role: 'PRODUCTION_PLANNER' },
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

describe('Audit log viewer (T5.6, FR-25)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  // audit_logs is append-only (BR-16) and cannot be cleaned up, so every run uses its own
  // entity type and ids and filters on them.
  const entityType = `T56Test-${randomUUID().slice(0, 8)}`;
  const orderA = randomUUID();
  const orderB = randomUUID();

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    await seedCatalog(prisma);
    await seedUsers(prisma, null, '');
    await prisma.auditLog.createMany({
      data: [
        {
          entityType,
          entityId: orderA,
          action: 'CREATE_DRAFT',
          newValue: { status: 'DRAFT' },
          actorId: PLANNER_ID,
          createdAt: new Date('2026-10-17T09:00:00Z'),
        },
        {
          entityType,
          entityId: orderA,
          action: 'CONFIRM_ORDER',
          oldValue: { status: 'DRAFT' },
          newValue: { status: 'CONFIRMED' },
          actorId: PLANNER_ID,
          createdAt: new Date('2026-10-18T09:00:00Z'),
        },
        {
          entityType,
          entityId: orderB,
          action: 'UPDATE_DRAFT',
          newValue: { notes: 'x' },
          actorId: ADMIN_ID,
          createdAt: new Date('2026-10-18T10:00:00Z'),
        },
        {
          entityType,
          entityId: orderB,
          action: 'SYSTEM_EVENT',
          newValue: { status: 'READY' },
          actorId: null,
          createdAt: new Date('2026-10-19T10:00:00Z'),
        },
      ],
    });

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
    await prisma?.$disconnect();
  });

  it('FR-25: requires a login (401)', async () => {
    await request(app.getHttpServer()).get('/audit').expect(401);
    await request(app.getHttpServer()).get('/audit/filter-options').expect(401);
  });

  it('FR-25: refuses roles other than Admin and Manager (403)', async () => {
    for (const token of ['Bearer operator-token', 'Bearer planner-token']) {
      await request(app.getHttpServer()).get('/audit').set('Authorization', token).expect(403);
      await request(app.getHttpServer())
        .get('/audit/filter-options')
        .set('Authorization', token)
        .expect(403);
    }
  });

  it('FR-25: Admin filters by entity type, newest first, with actor names', async () => {
    const res = await request(app.getHttpServer())
      .get('/audit')
      .query({ entityType })
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    expect(res.body.total).toBe(4);
    expect(res.body.items.map((item: { action: string }) => item.action)).toEqual([
      'SYSTEM_EVENT',
      'UPDATE_DRAFT',
      'CONFIRM_ORDER',
      'CREATE_DRAFT',
    ]);
    const confirm = res.body.items[2];
    expect(confirm).toMatchObject({
      entityId: orderA,
      oldValue: { status: 'DRAFT' },
      newValue: { status: 'CONFIRMED' },
      actorId: PLANNER_ID,
      actorName: 'Điều Độ Kế Hoạch Sản Xuất',
      actorEmail: 'planner@denimflow.internal',
      createdAt: '2026-10-18T09:00:00.000Z',
    });
    expect(typeof confirm.id).toBe('string');
    expect(res.body.items[0]).toMatchObject({ actorId: null, actorName: null });
  });

  it('FR-25: Manager filters by entity id, actor and date range', async () => {
    const server = app.getHttpServer();
    const byEntity = await request(server)
      .get('/audit')
      .query({ entityType, entityId: orderA })
      .set('Authorization', 'Bearer manager-token')
      .expect(200);
    expect(byEntity.body.items.map((item: { action: string }) => item.action)).toEqual([
      'CONFIRM_ORDER',
      'CREATE_DRAFT',
    ]);

    // Seeded ids such as 00000000-...-0003 must be accepted (not RFC version-4 UUIDs).
    const byActor = await request(server)
      .get('/audit')
      .query({ entityType, actorId: ADMIN_ID })
      .set('Authorization', 'Bearer manager-token')
      .expect(200);
    expect(byActor.body.items.map((item: { action: string }) => item.action)).toEqual([
      'UPDATE_DRAFT',
    ]);

    const byDate = await request(server)
      .get('/audit')
      .query({ entityType, from: '2026-10-18T00:00:00.000Z', to: '2026-10-18T23:59:59.999Z' })
      .set('Authorization', 'Bearer manager-token')
      .expect(200);
    expect(byDate.body.items.map((item: { action: string }) => item.action)).toEqual([
      'UPDATE_DRAFT',
      'CONFIRM_ORDER',
    ]);
  });

  it('FR-25: pages through the results', async () => {
    const res = await request(app.getHttpServer())
      .get('/audit')
      .query({ entityType, page: 2, limit: 3 })
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    expect(res.body).toMatchObject({ total: 4, page: 2, limit: 3, totalPages: 2 });
    expect(res.body.items.map((item: { action: string }) => item.action)).toEqual(['CREATE_DRAFT']);
  });

  it('FR-25: rejects an invalid query with 422', async () => {
    const server = app.getHttpServer();
    for (const query of [{ limit: 101 }, { entityId: 'ord-1' }, { from: 'yesterday' }]) {
      const res = await request(server)
        .get('/audit')
        .query(query)
        .set('Authorization', 'Bearer admin-token')
        .expect(422);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    }
  });

  it('FR-25: lists the logged entity types and the accounts for the filters', async () => {
    const res = await request(app.getHttpServer())
      .get('/audit/filter-options')
      .set('Authorization', 'Bearer manager-token')
      .expect(200);

    expect(res.body.entityTypes).toContain(entityType);
    expect(res.body.actors).toContainEqual({
      id: PLANNER_ID,
      fullName: 'Điều Độ Kế Hoạch Sản Xuất',
      email: 'planner@denimflow.internal',
    });
  });
});
