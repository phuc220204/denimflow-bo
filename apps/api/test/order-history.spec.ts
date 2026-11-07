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
const PLANNER_ID = '00000000-0000-0000-0000-000000000003';
const users: Record<string, { id: string; role: string }> = {
  'Bearer planner-token': { id: PLANNER_ID, role: 'PRODUCTION_PLANNER' },
  'Bearer keeper-token': { id: '00000000-0000-0000-0000-000000000004', role: 'WAREHOUSE_KEEPER' },
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

// Foreign keys from order history to its parent. Deleting the parent must fail, not cascade.
const HISTORY_FOREIGN_KEYS = [
  'order_size_lines_order_id_fkey',
  'bom_lines_order_id_fkey',
  'material_allocations_bom_line_id_fkey',
  'material_requests_order_id_fkey',
  'material_requests_bom_line_id_fkey',
  'customer_acknowledgements_order_id_fkey',
  'workflow_instances_order_id_fkey',
  'step_instances_instance_id_fkey',
];

describe('Order history is protected (D1, R-03, R-28)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let orderId: string;
  let lotId: string;
  const http = () => request(app.getHttpServer());
  // Own style, norm and lot per run, so the seeded demo data other tests use is untouched.
  const suffix = randomUUID().slice(0, 8);

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    await seedCatalog(prisma);
    await seedUsers(prisma, null, '');

    const [fabric, color] = await Promise.all([
      prisma.fabricType.findUniqueOrThrow({ where: { code: 'DN-12-RIGID' } }),
      prisma.colorOption.findUniqueOrThrow({ where: { code: 'CLR-INDIGO' } }),
    ]);
    const style = await prisma.style.create({
      data: {
        styleCode: `D1-${suffix}`,
        name: `D1 style ${suffix}`,
        bomNorms: {
          create: [{ size: '30', materialType: 'FABRIC', qtyPerPiece: 1.2, unit: 'm' }],
        },
      },
    });
    const lot = await prisma.fabricLot.create({
      data: {
        lotNo: `D1-LOT-${suffix}`,
        fabricTypeId: fabric.id,
        colorId: color.id,
        availableMeters: 100,
      },
    });
    lotId = lot.id;
    const order = await prisma.productionOrder.create({
      data: {
        orderNumber: `D1-${suffix}`,
        styleId: style.id,
        fabricTypeId: fabric.id,
        colorId: color.id,
        dueDate: new Date('2026-12-31'),
        createdBy: PLANNER_ID,
        sizeLines: { create: [{ size: '30', plannedQty: 10 }] },
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

  const fabricBomLine = () =>
    prisma.bomLine.findFirstOrThrow({ where: { orderId, materialType: 'FABRIC' } });

  it('R-03: every order-history foreign key is ON DELETE RESTRICT', async () => {
    const rows = await prisma.$queryRaw<{ conname: string; confdeltype: string }[]>`
      select conname::text, confdeltype::text from pg_constraint
      where conname::text = any(${HISTORY_FOREIGN_KEYS})`;

    expect(rows.map((r) => r.conname).sort()).toEqual([...HISTORY_FOREIGN_KEYS].sort());
    // 'r' = RESTRICT, 'c' = CASCADE (pg_constraint.confdeltype).
    expect(rows.filter((r) => r.confdeltype !== 'r')).toEqual([]);
  });

  it('R-28: the BOM may be recalculated while nothing is allocated yet', async () => {
    for (let i = 0; i < 2; i += 1) {
      await http()
        .post(`/orders/${orderId}/bom/calculate`)
        .set('Authorization', 'Bearer planner-token')
        .expect(201);
    }
    expect(Number((await fabricBomLine()).requiredQty)).toBe(12);
  });

  it('R-28: recalculating the BOM after an allocation is refused and keeps the allocation', async () => {
    const line = await fabricBomLine();
    await http()
      .post('/inventory/allocate')
      .set('Authorization', 'Bearer keeper-token')
      .send({ orderId, bomLineId: line.id, fabricLotId: lotId, quantity: 5 })
      .expect(201);

    const res = await http()
      .post(`/orders/${orderId}/bom/calculate`)
      .set('Authorization', 'Bearer planner-token')
      .expect(409);

    expect(res.body.brId).toBe('R-28');
    expect(await prisma.materialAllocation.count({ where: { bomLineId: line.id } })).toBe(1);
    const lot = await prisma.fabricLot.findUniqueOrThrow({ where: { id: lotId } });
    expect(Number(lot.availableMeters)).toBe(95);
  });

  it('R-03: a BOM line with an allocation cannot be deleted', async () => {
    const line = await fabricBomLine();

    await expect(prisma.bomLine.delete({ where: { id: line.id } })).rejects.toThrow(/foreign key/i);
  });

  it('R-03: an order with history cannot be deleted', async () => {
    await expect(prisma.productionOrder.delete({ where: { id: orderId } })).rejects.toThrow(
      /foreign key/i,
    );
    expect(await prisma.orderSizeLine.count({ where: { orderId } })).toBe(1);
  });
});
