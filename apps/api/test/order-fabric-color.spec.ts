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

const PLANNER_ID = '00000000-0000-0000-0000-000000000003';

const fakeAuthService = {
  async getMe(authHeader?: string) {
    if (authHeader !== 'Bearer planner-token') {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ hoặc đã hết hạn');
    }
    return {
      id: PLANNER_ID,
      role: 'PRODUCTION_PLANNER',
      email: 'x@denimflow.test',
      fullName: 'Test',
      isActive: true,
    };
  },
};

// Seeded matrix (src/seed/catalog.ts): DN-12-RIGID allows Indigo and forbids Grey.
describe('Fabric–color matrix on create and confirm (BR-04)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let styleId: string;
  let rigidId: string;
  let indigoId: string;
  let greyId: string;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    await seedCatalog(prisma);
    await seedUsers(prisma, null, '');

    const suffix = randomUUID().slice(0, 8);
    const [style, rigid, indigo, grey] = await Promise.all([
      prisma.style.create({ data: { styleCode: `BR04-${suffix}`, name: `BR-04 ${suffix}` } }),
      prisma.fabricType.findUniqueOrThrow({ where: { code: 'DN-12-RIGID' } }),
      prisma.colorOption.findUniqueOrThrow({ where: { code: 'CLR-INDIGO' } }),
      prisma.colorOption.findUniqueOrThrow({ where: { code: 'CLR-GREY' } }),
    ]);
    styleId = style.id;
    rigidId = rigid.id;
    indigoId = indigo.id;
    greyId = grey.id;

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

  const draftBody = (colorId: string) => ({
    styleId,
    dueDate: '2026-12-31',
    fabricTypeId: rigidId,
    colorId,
    sizeLines: [{ size: '30', plannedQty: 10 }],
  });

  it('BR-04: creating a draft with a forbidden fabric–color pair is refused', async () => {
    const res = await http()
      .post('/orders')
      .set('Authorization', 'Bearer planner-token')
      .send(draftBody(greyId))
      .expect(409);

    expect(res.body.brId).toBe('BR-04');
  });

  it('BR-04: creating a draft with an allowed pair works', async () => {
    await http()
      .post('/orders')
      .set('Authorization', 'Bearer planner-token')
      .send(draftBody(indigoId))
      .expect(201);
  });

  it('BR-04: confirming an order whose pair is not allowed is refused', async () => {
    // A draft stored before the check existed (or before the matrix cell was switched off).
    const order = await prisma.productionOrder.create({
      data: {
        orderNumber: `BR04-${randomUUID().slice(0, 8)}`,
        styleId,
        fabricTypeId: rigidId,
        colorId: greyId,
        dueDate: new Date('2026-12-31'),
        createdBy: PLANNER_ID,
        sizeLines: { create: [{ size: '30', plannedQty: 10 }] },
      },
    });

    const res = await http()
      .post(`/orders/${order.id}/confirm`)
      .set('Authorization', 'Bearer planner-token')
      .expect(409);

    expect(res.body.brId).toBe('BR-04');
    const after = await prisma.productionOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.status).toBe('DRAFT');
  });
});
