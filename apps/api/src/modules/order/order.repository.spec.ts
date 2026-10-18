import type { Prisma } from '../../generated/prisma/client.js';
import type { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { OrderRepository } from './order.repository.js';

describe('OrderRepository', () => {
  it('generates order number PO-YYYY-0001 when no previous orders exist', async () => {
    const mockPrisma = {
      productionOrder: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };

    const repo = new OrderRepository(mockPrisma as unknown as PrismaService);
    const tx = mockPrisma as unknown as Prisma.TransactionClient;

    const orderNumber = await repo.generateOrderNumber(tx, 2026);
    expect(orderNumber).toBe('PO-2026-0001');
  });

  it('generates sequential order number PO-YYYY-NNNN based on latest order', async () => {
    const mockPrisma = {
      productionOrder: {
        findFirst: vi.fn().mockResolvedValue({ orderNumber: 'PO-2026-0042' }),
      },
    };

    const repo = new OrderRepository(mockPrisma as unknown as PrismaService);
    const tx = mockPrisma as unknown as Prisma.TransactionClient;

    const orderNumber = await repo.generateOrderNumber(tx, 2026);
    expect(orderNumber).toBe('PO-2026-0043');
  });
});
