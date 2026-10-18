import { randomUUID } from 'node:crypto';
import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { Role } from '@denimflow/shared';
import type { AuthService } from '../auth/auth.service.js';
import { InventoryController } from './inventory.controller.js';
import type { InventoryService } from './inventory.service.js';

describe('InventoryController', () => {
  it('allows WAREHOUSE_KEEPER to allocate fabric', async () => {
    const mockAuthService = {
      getMe: vi.fn().mockResolvedValue({
        id: 'keeper-1',
        role: Role.WAREHOUSE_KEEPER,
      }),
    } as unknown as AuthService;

    const mockInventoryService = {
      allocateFabric: vi.fn().mockResolvedValue({ isFullyAllocated: true }),
    } as unknown as InventoryService;

    const controller = new InventoryController(mockInventoryService, mockAuthService);

    const result = await controller.allocateFabric('Bearer keeper-token', {
      orderId: randomUUID(),
      bomLineId: randomUUID(),
      fabricLotId: randomUUID(),
      quantity: 100,
    });

    expect(result).toEqual({ isFullyAllocated: true });
    expect(mockInventoryService.allocateFabric).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 100 }),
      'keeper-1',
    );
  });

  it('rejects STATION_OPERATOR from allocating fabric with ForbiddenException', async () => {
    const mockAuthService = {
      getMe: vi.fn().mockResolvedValue({
        id: 'operator-1',
        role: Role.STATION_OPERATOR,
      }),
    } as unknown as AuthService;

    const mockInventoryService = {
      allocateFabric: vi.fn(),
    } as unknown as InventoryService;

    const controller = new InventoryController(mockInventoryService, mockAuthService);

    await expect(
      controller.allocateFabric('Bearer op-token', {
        orderId: randomUUID(),
        bomLineId: randomUUID(),
        fabricLotId: randomUUID(),
        quantity: 100,
      }),
    ).rejects.toThrow(ForbiddenException);
  });
});
