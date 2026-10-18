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

  describe('selectFabricColor (BR-04, BR-05)', () => {
    const actorId = '11111111-1111-4111-8111-111111111111';
    const orderId = 'order-123';
    const fabricTypeId = 'fab-1';
    const colorId = 'col-1';

    it('BR-05: rejects fabric/color change once CUTTING has started', async () => {
      const existingOrder = {
        id: orderId,
        status: 'CONFIRMED',
        fabricTypeId: 'fab-old',
        colorId: 'col-old',
        washTypeId: null,
        workflowInstance: {
          stepInstances: [
            {
              stepDefinition: { code: 'CUTTING' },
              status: 'IN_PROGRESS',
            },
          ],
        },
      };

      const txMock = {
        productionOrder: {
          findUnique: vi.fn().mockResolvedValue(existingOrder),
        },
      };

      const mockPrisma = {
        $transaction: vi.fn((cb: (tx: unknown) => unknown) => cb(txMock)),
      };

      const repo = new OrderRepository(mockPrisma as unknown as PrismaService);

      await expect(
        repo.selectFabricColor(orderId, { fabricTypeId, colorId }, actorId),
      ).rejects.toThrow('BR-05: Fabric, color and wash are locked once CUTTING has started');
    });

    it('BR-05: rejects fabric/color change when order status is IN_PRODUCTION', async () => {
      const existingOrder = {
        id: orderId,
        status: 'IN_PRODUCTION',
        fabricTypeId: 'fab-old',
        colorId: 'col-old',
        washTypeId: null,
        workflowInstance: null,
      };

      const txMock = {
        productionOrder: {
          findUnique: vi.fn().mockResolvedValue(existingOrder),
        },
      };

      const mockPrisma = {
        $transaction: vi.fn((cb: (tx: unknown) => unknown) => cb(txMock)),
      };

      const repo = new OrderRepository(mockPrisma as unknown as PrismaService);

      await expect(
        repo.selectFabricColor(orderId, { fabricTypeId, colorId }, actorId),
      ).rejects.toThrow('BR-05: Fabric, color and wash are locked once CUTTING has started');
    });

    it('BR-04: rejects invalid fabric and color pair per compatibility matrix', async () => {
      const existingOrder = {
        id: orderId,
        status: 'DRAFT',
        fabricTypeId: 'fab-old',
        colorId: 'col-old',
        washTypeId: null,
        workflowInstance: {
          stepInstances: [
            {
              stepDefinition: { code: 'CUTTING' },
              status: 'PENDING',
            },
          ],
        },
      };

      const txMock = {
        productionOrder: {
          findUnique: vi.fn().mockResolvedValue(existingOrder),
        },
        fabricColorRule: {
          findUnique: vi.fn().mockResolvedValue({ isAllowed: false }),
        },
      };

      const mockPrisma = {
        $transaction: vi.fn((cb: (tx: unknown) => unknown) => cb(txMock)),
      };

      const repo = new OrderRepository(mockPrisma as unknown as PrismaService);

      await expect(
        repo.selectFabricColor(orderId, { fabricTypeId, colorId }, actorId),
      ).rejects.toThrow(
        'BR-04: Selected fabric and color pair is not allowed per compatibility matrix',
      );
    });

    it('BR-04: allows valid fabric and color pair per compatibility matrix and creates audit log', async () => {
      const existingOrder = {
        id: orderId,
        status: 'DRAFT',
        fabricTypeId: 'fab-old',
        colorId: 'col-old',
        washTypeId: null,
        workflowInstance: {
          stepInstances: [
            {
              stepDefinition: { code: 'CUTTING' },
              status: 'READY',
            },
          ],
        },
      };

      const updatedOrder = {
        ...existingOrder,
        fabricTypeId,
        colorId,
        version: 2,
      };

      const txMock = {
        productionOrder: {
          findUnique: vi.fn().mockResolvedValue(existingOrder),
          update: vi.fn().mockResolvedValue(updatedOrder),
        },
        fabricColorRule: {
          findUnique: vi.fn().mockResolvedValue({ isAllowed: true }),
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
        },
      };

      const mockPrisma = {
        $transaction: vi.fn((cb: (tx: unknown) => unknown) => cb(txMock)),
      };

      const repo = new OrderRepository(mockPrisma as unknown as PrismaService);

      const result = await repo.selectFabricColor(orderId, { fabricTypeId, colorId }, actorId);
      expect(result).toEqual(updatedOrder);
      expect(txMock.productionOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: orderId },
          data: expect.objectContaining({ fabricTypeId, colorId }),
        }),
      );
      expect(txMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'SELECT_FABRIC_COLOR',
            actorId,
          }),
        }),
      );
    });
  });
});
