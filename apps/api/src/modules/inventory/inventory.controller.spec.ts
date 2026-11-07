import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { GUARDS_METADATA } from '@nestjs/common/constants.js';
import { describe, expect, it, vi } from 'vitest';
import { Role } from '@denimflow/shared';
import { AuthGuard } from '../auth/auth.guard.js';
import type { AuthResponse } from '../auth/auth.service.js';
import { ROLES_KEY } from '../auth/roles.decorator.js';
import { InventoryController } from './inventory.controller.js';
import type { InventoryService } from './inventory.service.js';

const rolesOf = (method: keyof InventoryController): unknown =>
  Reflect.getMetadata(ROLES_KEY, InventoryController.prototype[method]);

describe('InventoryController', () => {
  it('every route requires a login', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, InventoryController)).toEqual([AuthGuard]);
  });

  it('read routes are open to any active user', () => {
    for (const method of [
      'listFabricLots',
      'listMaterialRequests',
      'listOrdersForAllocation',
      'getCuttingGate',
    ] as const) {
      expect(rolesOf(method)).toBeUndefined();
    }
  });

  it('fabric allocation is limited to Warehouse Keeper, Admin and Manager', () => {
    expect(rolesOf('allocateFabric')).toEqual([Role.WAREHOUSE_KEEPER, Role.ADMIN, Role.MANAGER]);
  });

  it('passes the verified Warehouse Keeper id as the actor when allocating fabric', async () => {
    const keeper: AuthResponse['user'] = {
      id: 'keeper-1',
      email: 'keeper@denimflow.test',
      fullName: 'Keeper',
      role: Role.WAREHOUSE_KEEPER,
      isActive: true,
    };
    const inventoryService = {
      allocateFabric: vi.fn().mockResolvedValue({ isFullyAllocated: true }),
    };
    const controller = new InventoryController(inventoryService as unknown as InventoryService);

    const result = await controller.allocateFabric(
      {
        orderId: randomUUID(),
        bomLineId: randomUUID(),
        fabricLotId: randomUUID(),
        quantity: 100,
      },
      keeper,
    );

    expect(result).toEqual({ isFullyAllocated: true });
    expect(inventoryService.allocateFabric).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 100 }),
      'keeper-1',
    );
  });
});
