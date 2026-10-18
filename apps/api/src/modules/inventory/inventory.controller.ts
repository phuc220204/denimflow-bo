import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { allocateFabricSchema } from '@denimflow/shared';
import { AuthService } from '../auth/auth.service.js';
import { InventoryService } from './inventory.service.js';

@Controller('inventory')
export class InventoryController {
  constructor(
    @Inject(InventoryService) private readonly inventoryService: InventoryService,
    @Inject(AuthService) private readonly authService: AuthService,
  ) {}

  private async assertWarehouseKeeperOrAdmin(authHeader?: string): Promise<string> {
    const user = await this.authService.getMe(authHeader);
    if (user.role !== 'WAREHOUSE_KEEPER' && user.role !== 'ADMIN' && user.role !== 'MANAGER') {
      throw new ForbiddenException(
        'Chỉ Thủ kho (Warehouse Keeper), Quản lý hoặc Quản trị viên mới có quyền thao tác phân bổ kho',
      );
    }
    return user.id;
  }

  private async assertAuthenticated(authHeader?: string): Promise<string> {
    const user = await this.authService.getMe(authHeader);
    return user.id;
  }

  @Get('fabric-lots')
  async listFabricLots(
    @Headers('authorization') authHeader: string | undefined,
    @Query('fabricTypeId') fabricTypeId?: string,
    @Query('colorId') colorId?: string,
  ) {
    await this.assertAuthenticated(authHeader);
    return this.inventoryService.listFabricLots(fabricTypeId, colorId);
  }

  @Get('requests')
  async listMaterialRequests(
    @Headers('authorization') authHeader: string | undefined,
    @Query('orderId') orderId?: string,
  ) {
    await this.assertAuthenticated(authHeader);
    return this.inventoryService.listMaterialRequests(orderId);
  }

  @Get('allocations/orders')
  async listOrdersForAllocation(@Headers('authorization') authHeader: string | undefined) {
    await this.assertAuthenticated(authHeader);
    return this.inventoryService.listOrdersForAllocation();
  }

  @Get('cutting-gate/:orderId')
  async getCuttingGate(
    @Headers('authorization') authHeader: string | undefined,
    @Param('orderId') orderId: string,
  ) {
    await this.assertAuthenticated(authHeader);
    return this.inventoryService.getCuttingGate(orderId);
  }

  @Post('allocate')
  async allocateFabric(
    @Headers('authorization') authHeader: string | undefined,
    @Body() body: unknown,
  ) {
    const userId = await this.assertWarehouseKeeperOrAdmin(authHeader);
    const dto = allocateFabricSchema.parse(body);
    return this.inventoryService.allocateFabric(dto, userId);
  }
}
