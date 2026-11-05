import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import { allocateFabricSchema, Role } from '@denimflow/shared';
import { AuthGuard } from '../auth/auth.guard.js';
import type { AuthResponse } from '../auth/auth.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { InventoryService } from './inventory.service.js';

// Any active user may read stock and the cutting gate; only these roles allocate fabric lots.
const ALLOCATORS = [Role.WAREHOUSE_KEEPER, Role.ADMIN, Role.MANAGER];

@Controller('inventory')
@UseGuards(AuthGuard)
export class InventoryController {
  constructor(@Inject(InventoryService) private readonly inventoryService: InventoryService) {}

  @Get('fabric-lots')
  listFabricLots(@Query('fabricTypeId') fabricTypeId?: string, @Query('colorId') colorId?: string) {
    return this.inventoryService.listFabricLots(fabricTypeId, colorId);
  }

  @Get('requests')
  listMaterialRequests(@Query('orderId') orderId?: string) {
    return this.inventoryService.listMaterialRequests(orderId);
  }

  @Get('allocations/orders')
  listOrdersForAllocation() {
    return this.inventoryService.listOrdersForAllocation();
  }

  @Get('cutting-gate/:orderId')
  getCuttingGate(@Param('orderId') orderId: string) {
    return this.inventoryService.getCuttingGate(orderId);
  }

  @Post('allocate')
  @Roles(...ALLOCATORS)
  allocateFabric(@Body() body: unknown, @CurrentUser() user: AuthResponse['user']) {
    const dto = allocateFabricSchema.parse(body);
    return this.inventoryService.allocateFabric(dto, user.id);
  }
}
