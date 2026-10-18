import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import type { InventoryRepository } from './inventory.repository.js';
import { InventoryService } from './inventory.service.js';

describe('InventoryService', () => {
  it('delegates listFabricLots and allocateFabric to repository', async () => {
    const mockRepo = {
      listFabricLots: vi.fn().mockResolvedValue([{ id: 'lot-1', lotNo: 'LOT-01' }]),
      allocateFabric: vi.fn().mockResolvedValue({
        allocation: { id: 'alloc-1' },
        isFullyAllocated: true,
        remainingMissingQty: 0,
      }),
      listMaterialRequests: vi.fn().mockResolvedValue([]),
      getCuttingGate: vi.fn().mockResolvedValue({ passed: true }),
    } as unknown as InventoryRepository;

    const mockPrisma = {} as unknown as PrismaService;

    const service = new InventoryService(mockRepo, mockPrisma);

    const lots = await service.listFabricLots('fab-1', 'col-1');
    expect(lots).toEqual([{ id: 'lot-1', lotNo: 'LOT-01' }]);
    expect(mockRepo.listFabricLots).toHaveBeenCalledWith('fab-1', 'col-1');

    const res = await service.allocateFabric(
      {
        orderId: 'order-1',
        bomLineId: 'bom-1',
        fabricLotId: 'lot-1',
        quantity: 100,
      },
      'user-1',
    );
    expect(res.isFullyAllocated).toBe(true);
  });
});
