import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  attachAcknowledgementSchema,
  createProductionOrderSchema,
  productionOrderQuerySchema,
  Role,
  selectFabricColorSchema,
  updateProductionOrderSchema,
} from '@denimflow/shared';
import { AuthGuard } from '../auth/auth.guard.js';
import type { AuthResponse } from '../auth/auth.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { OrderService } from './order.service.js';

// Roles that may create, edit and confirm a production order. Any active user may read orders.
const ORDER_EDITORS = [Role.PRODUCTION_PLANNER, Role.ADMIN, Role.MANAGER];

@Controller('orders')
@UseGuards(AuthGuard)
export class OrderController {
  constructor(@Inject(OrderService) private readonly orderService: OrderService) {}

  @Get()
  listOrders(@Query() rawQuery: unknown) {
    const query = productionOrderQuerySchema.parse(rawQuery);
    return this.orderService.listOrders(query);
  }

  @Get(':id')
  getOrderById(@Param('id') id: string) {
    return this.orderService.getOrderById(id);
  }

  @Post()
  @Roles(...ORDER_EDITORS)
  createDraftOrder(@Body() rawBody: unknown, @CurrentUser() user: AuthResponse['user']) {
    const dto = createProductionOrderSchema.parse(rawBody);
    return this.orderService.createDraftOrder(dto, user.id);
  }

  @Patch(':id')
  @Roles(...ORDER_EDITORS)
  updateDraftOrder(
    @Param('id') id: string,
    @Body() rawBody: unknown,
    @CurrentUser() user: AuthResponse['user'],
  ) {
    const dto = updateProductionOrderSchema.parse(rawBody);
    return this.orderService.updateDraftOrder(id, dto, user.id);
  }

  @Patch(':id/fabric-color')
  @Roles(...ORDER_EDITORS)
  selectFabricColor(
    @Param('id') id: string,
    @Body() rawBody: unknown,
    @CurrentUser() user: AuthResponse['user'],
  ) {
    const dto = selectFabricColorSchema.parse(rawBody);
    return this.orderService.selectFabricColor(id, dto, user.id);
  }

  @Post(':id/bom/calculate')
  @Roles(...ORDER_EDITORS)
  calculateBom(@Param('id') id: string, @CurrentUser() user: AuthResponse['user']) {
    return this.orderService.calculateAndPersistBom(id, user.id);
  }

  @Get(':id/bom')
  getBomLines(@Param('id') id: string) {
    return this.orderService.getBomLines(id);
  }

  @Post(':id/acknowledgement')
  @Roles(...ORDER_EDITORS)
  attachAcknowledgement(
    @Param('id') id: string,
    @Body() rawBody: unknown,
    @CurrentUser() user: AuthResponse['user'],
  ) {
    const dto = attachAcknowledgementSchema.parse(rawBody);
    return this.orderService.attachCustomerAcknowledgement(id, dto, user.id);
  }

  @Post(':id/confirm')
  @Roles(...ORDER_EDITORS)
  confirmOrder(@Param('id') id: string, @CurrentUser() user: AuthResponse['user']) {
    return this.orderService.confirmOrder(id, user.id);
  }
}
