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
import { seedUsers } from '../src/seed/users.js';

const ADMIN_ID = '00000000-0000-0000-0000-000000000001';

const fakeAuthService = {
  async getMe(authHeader?: string) {
    if (authHeader !== 'Bearer admin-token') {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ hoặc đã hết hạn');
    }
    return {
      id: ADMIN_ID,
      role: 'ADMIN',
      email: 'x@denimflow.test',
      fullName: 'T',
      isActive: true,
    };
  },
};

// Catalog columns an order points to. Deleting the catalog row must fail, not blank the order.
const ORDER_CATALOG_FOREIGN_KEYS = [
  'production_orders_fabric_type_id_fkey',
  'production_orders_color_id_fkey',
  'production_orders_wash_type_id_fkey',
  'production_orders_qc_profile_id_fkey',
];

describe('Catalog rows used by an order cannot be deleted (FR-02, R-03)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let orderId: string;
  let fabricId: string;
  let colorId: string;
  let washId: string;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    await seedUsers(prisma, null, '');

    // Own catalog rows per run (no fabric lot, so only the order refers to them).
    const suffix = randomUUID().slice(0, 6).toUpperCase();
    const [style, fabric, color, wash] = await Promise.all([
      prisma.style.create({ data: { styleCode: `REF-${suffix}`, name: `Ref ${suffix}` } }),
      prisma.fabricType.create({
        data: { code: `FAB-REF-${suffix}`, name: 'Ref fabric', stretchType: 'RIGID' },
      }),
      prisma.colorOption.create({ data: { code: `CLR-REF-${suffix}`, name: 'Ref color' } }),
      prisma.washType.create({ data: { code: `WSH-REF-${suffix}`, name: 'Ref wash' } }),
    ]);
    fabricId = fabric.id;
    colorId = color.id;
    washId = wash.id;
    const qcProfile = await prisma.qcProfile.create({
      data: {
        styleId: style.id,
        profileType: 'FULL_PROCESS',
        maxShrinkagePercent: 3,
        maxColorFadingLevel: 1,
      },
    });
    const order = await prisma.productionOrder.create({
      data: {
        orderNumber: `REF-${suffix}`,
        styleId: style.id,
        fabricTypeId: fabricId,
        colorId,
        washTypeId: washId,
        qcProfileId: qcProfile.id,
        status: 'CONFIRMED',
        dueDate: new Date('2026-12-31'),
        createdBy: ADMIN_ID,
      },
    });
    orderId = order.id;

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

  it('R-03: every order-to-catalog foreign key is ON DELETE RESTRICT', async () => {
    const rows = await prisma.$queryRaw<{ conname: string; confdeltype: string }[]>`
      select conname::text, confdeltype::text from pg_constraint
      where conname::text = any(${ORDER_CATALOG_FOREIGN_KEYS})`;

    expect(rows.map((r) => r.conname).sort()).toEqual([...ORDER_CATALOG_FOREIGN_KEYS].sort());
    // 'r' = RESTRICT, 'n' = SET NULL (pg_constraint.confdeltype).
    expect(rows.filter((r) => r.confdeltype !== 'r')).toEqual([]);
  });

  it.each([
    ['color option', () => `/catalog/color-options/${colorId}`],
    ['fabric type', () => `/catalog/fabric-types/${fabricId}`],
    ['wash type', () => `/catalog/wash-types/${washId}`],
  ])(
    'FR-02: deleting a %s used by an order is refused and the order keeps it',
    async (_n, path) => {
      await http().delete(path()).set('Authorization', 'Bearer admin-token').expect(400);

      const order = await prisma.productionOrder.findUniqueOrThrow({ where: { id: orderId } });
      expect([order.fabricTypeId, order.colorId, order.washTypeId]).toEqual([
        fabricId,
        colorId,
        washId,
      ]);
    },
  );
});
