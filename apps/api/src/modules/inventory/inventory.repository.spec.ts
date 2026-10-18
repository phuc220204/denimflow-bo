import { describe, expect, it, vi } from 'vitest';
import type { AllocateFabricDto } from '@denimflow/shared';
import { BusinessRuleViolation } from '../../common/errors/business-rule-violation.js';
import type { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { InventoryRepository } from './inventory.repository.js';

describe('InventoryRepository (T3.4, FR-09, BR-06)', () => {
  it('BR-06: rejects allocation when requested qty exceeds available meters in lot', async () => {
    const mockTx = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          id: 'lot-1',
          fabric_type_id: 'fabric-1',
          color_id: 'color-1',
          lot_no: 'LOT-01',
          available_meters: 100, // Only 100m available
          shrinkage_percent: 2.5,
        },
      ]),
    };

    const mockPrisma = {
      $transaction: vi.fn().mockImplementation((cb: (tx: typeof mockTx) => unknown) => cb(mockTx)),
    } as unknown as PrismaService;

    const repo = new InventoryRepository(mockPrisma);

    const dto: AllocateFabricDto = {
      orderId: 'order-1',
      bomLineId: 'bom-1',
      fabricLotId: 'lot-1',
      quantity: 150, // Asking for 150m > 100m
    };

    await expect(repo.allocateFabric(dto, 'user-1')).rejects.toThrow(BusinessRuleViolation);
  });

  it('BR-04: rejects allocation when fabric lot type does not match order', async () => {
    const mockTx = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          id: 'lot-1',
          fabric_type_id: 'fabric-DIFFERENT',
          color_id: 'color-1',
          lot_no: 'LOT-01',
          available_meters: 500,
          shrinkage_percent: 2.5,
        },
      ]),
      bomLine: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'bom-1',
          orderId: 'order-1',
          materialType: 'FABRIC',
          requiredQty: 300,
          materialAllocations: [],
          order: {
            fabricTypeId: 'fabric-1',
            colorId: 'color-1',
          },
        }),
      },
    };

    const mockPrisma = {
      $transaction: vi.fn().mockImplementation((cb: (tx: typeof mockTx) => unknown) => cb(mockTx)),
    } as unknown as PrismaService;

    const repo = new InventoryRepository(mockPrisma);

    const dto: AllocateFabricDto = {
      orderId: 'order-1',
      bomLineId: 'bom-1',
      fabricLotId: 'lot-1',
      quantity: 100,
    };

    await expect(repo.allocateFabric(dto, 'user-1')).rejects.toThrow(
      /Fabric lot type does not match order fabric type/i,
    );
  });

  it('BR-06: rejects allocation when total allocated would exceed BOM required quantity', async () => {
    const mockTx = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          id: 'lot-1',
          fabric_type_id: 'fabric-1',
          color_id: 'color-1',
          lot_no: 'LOT-01',
          available_meters: 1000,
          shrinkage_percent: 2.5,
        },
      ]),
      bomLine: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'bom-1',
          orderId: 'order-1',
          materialType: 'FABRIC',
          requiredQty: 300,
          materialAllocations: [{ allocatedQty: 250 }], // 250 already allocated
          order: {
            fabricTypeId: 'fabric-1',
            colorId: 'color-1',
          },
        }),
      },
    };

    const mockPrisma = {
      $transaction: vi.fn().mockImplementation((cb: (tx: typeof mockTx) => unknown) => cb(mockTx)),
    } as unknown as PrismaService;

    const repo = new InventoryRepository(mockPrisma);

    const dto: AllocateFabricDto = {
      orderId: 'order-1',
      bomLineId: 'bom-1',
      fabricLotId: 'lot-1',
      quantity: 100, // 250 + 100 = 350 > 300 required
    };

    await expect(repo.allocateFabric(dto, 'user-1')).rejects.toThrow(
      /would exceed required BOM quantity/i,
    );
  });

  it('BR-06: successfully allocates fabric, decrements lot, records MaterialRequest for shortage, and writes AuditLog', async () => {
    const mockTx = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          id: 'lot-1',
          fabric_type_id: 'fabric-1',
          color_id: 'color-1',
          lot_no: 'LOT-01',
          available_meters: 500,
          shrinkage_percent: 2.5,
        },
      ]),
      bomLine: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'bom-1',
          orderId: 'order-1',
          materialType: 'FABRIC',
          requiredQty: 400,
          materialAllocations: [],
          order: {
            fabricTypeId: 'fabric-1',
            colorId: 'color-1',
          },
        }),
      },
      fabricLot: {
        update: vi.fn().mockResolvedValue({ id: 'lot-1', availableMeters: 250 }),
      },
      materialAllocation: {
        create: vi.fn().mockResolvedValue({
          id: 'alloc-1',
          bomLineId: 'bom-1',
          fabricLotId: 'lot-1',
          allocatedQty: 250,
          fabricLot: { lotNo: 'LOT-01' },
        }),
      },
      materialRequest: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'req-1' }),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: 101n }),
      },
    };

    const mockPrisma = {
      $transaction: vi.fn().mockImplementation((cb: (tx: typeof mockTx) => unknown) => cb(mockTx)),
    } as unknown as PrismaService;

    const repo = new InventoryRepository(mockPrisma);

    const dto: AllocateFabricDto = {
      orderId: 'order-1',
      bomLineId: 'bom-1',
      fabricLotId: 'lot-1',
      quantity: 250,
    };

    const result = await repo.allocateFabric(dto, 'user-1');

    expect(result.isFullyAllocated).toBe(false);
    expect(result.remainingMissingQty).toBe(150); // 400 - 250 = 150
    expect(mockTx.fabricLot.update).toHaveBeenCalledWith({
      where: { id: 'lot-1' },
      data: { availableMeters: 250 }, // 500 - 250 = 250
    });
    expect(mockTx.materialRequest.create).toHaveBeenCalledWith({
      data: {
        orderId: 'order-1',
        bomLineId: 'bom-1',
        missingQty: 150,
        status: 'OPEN',
        requestedBy: 'user-1',
      },
    });
    expect(mockTx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'ALLOCATE_FABRIC',
          entityType: 'material_allocation',
        }),
      }),
    );
  });

  it('BR-06: getCuttingGate blocks when fabric is not fully allocated', async () => {
    const mockPrisma = {
      bomLine: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'bom-1',
          orderId: 'order-1',
          materialType: 'FABRIC',
          requiredQty: 400,
          materialAllocations: [{ allocatedQty: 250 }],
        }),
      },
    } as unknown as PrismaService;

    const repo = new InventoryRepository(mockPrisma);
    const gate = await repo.getCuttingGate('order-1');

    expect(gate.passed).toBe(false);
    expect(gate.ruleId).toBe('BR-06');
    expect(gate.missingQty).toBe(150);
  });

  it('BR-06: getCuttingGate passes when fabric is 100% allocated', async () => {
    const mockPrisma = {
      bomLine: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'bom-1',
          orderId: 'order-1',
          materialType: 'FABRIC',
          requiredQty: 400,
          materialAllocations: [{ allocatedQty: 400 }],
        }),
      },
    } as unknown as PrismaService;

    const repo = new InventoryRepository(mockPrisma);
    const gate = await repo.getCuttingGate('order-1');

    expect(gate.passed).toBe(true);
    expect(gate.missingQty).toBe(0);
  });
});
