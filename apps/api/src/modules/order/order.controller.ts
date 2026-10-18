import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  attachAcknowledgementSchema,
  createProductionOrderSchema,
  productionOrderQuerySchema,
  selectFabricColorSchema,
  updateProductionOrderSchema,
} from '@denimflow/shared';
import { AuthService } from '../auth/auth.service.js';
import { OrderService } from './order.service.js';

@Controller('orders')
export class OrderController {
  constructor(
    @Inject(OrderService) private readonly orderService: OrderService,
    @Inject(AuthService) private readonly authService: AuthService,
  ) {}

  private async assertPlannerOrAdmin(authHeader?: string): Promise<string> {
    const user = await this.authService.getMe(authHeader);
    if (user.role !== 'PRODUCTION_PLANNER' && user.role !== 'ADMIN' && user.role !== 'MANAGER') {
      throw new ForbiddenException(
        'Chỉ Người lập kế hoạch (Production Planner), Quản lý hoặc Quản trị viên mới có quyền thao tác',
      );
    }
    return user.id;
  }

  private async assertAuthenticated(authHeader?: string): Promise<string> {
    const user = await this.authService.getMe(authHeader);
    return user.id;
  }

  @Get()
  async listOrders(@Query() rawQuery: unknown, @Headers('authorization') authHeader?: string) {
    await this.assertAuthenticated(authHeader);
    const query = productionOrderQuerySchema.parse(rawQuery);
    return this.orderService.listOrders(query);
  }

  @Get(':id')
  async getOrderById(@Param('id') id: string, @Headers('authorization') authHeader?: string) {
    await this.assertAuthenticated(authHeader);
    return this.orderService.getOrderById(id);
  }

  @Post()
  async createDraftOrder(@Body() rawBody: unknown, @Headers('authorization') authHeader?: string) {
    const actorId = await this.assertPlannerOrAdmin(authHeader);
    const dto = createProductionOrderSchema.parse(rawBody);
    return this.orderService.createDraftOrder(dto, actorId);
  }

  @Patch(':id')
  async updateDraftOrder(
    @Param('id') id: string,
    @Body() rawBody: unknown,
    @Headers('authorization') authHeader?: string,
  ) {
    const actorId = await this.assertPlannerOrAdmin(authHeader);
    const dto = updateProductionOrderSchema.parse(rawBody);
    return this.orderService.updateDraftOrder(id, dto, actorId);
  }

  @Patch(':id/fabric-color')
  async selectFabricColor(
    @Param('id') id: string,
    @Body() rawBody: unknown,
    @Headers('authorization') authHeader?: string,
  ) {
    const actorId = await this.assertPlannerOrAdmin(authHeader);
    const dto = selectFabricColorSchema.parse(rawBody);
    return this.orderService.selectFabricColor(id, dto, actorId);
  }

  @Post(':id/bom/calculate')
  async calculateBom(@Param('id') id: string, @Headers('authorization') authHeader?: string) {
    const actorId = await this.assertPlannerOrAdmin(authHeader);
    return this.orderService.calculateAndPersistBom(id, actorId);
  }

  @Get(':id/bom')
  async getBomLines(@Param('id') id: string, @Headers('authorization') authHeader?: string) {
    await this.assertAuthenticated(authHeader);
    return this.orderService.getBomLines(id);
  }

  @Post(':id/acknowledgement')
  async attachAcknowledgement(
    @Param('id') id: string,
    @Body() rawBody: unknown,
    @Headers('authorization') authHeader?: string,
  ) {
    const actorId = await this.assertPlannerOrAdmin(authHeader);
    const dto = attachAcknowledgementSchema.parse(rawBody);
    return this.orderService.attachCustomerAcknowledgement(id, dto, actorId);
  }

  @Post(':id/confirm')
  async confirmOrder(@Param('id') id: string, @Headers('authorization') authHeader?: string) {
    const actorId = await this.assertPlannerOrAdmin(authHeader);
    return this.orderService.confirmOrder(id, actorId);
  }
}
