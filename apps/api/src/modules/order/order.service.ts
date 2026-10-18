import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateProductionOrderDto,
  ProductionOrderQueryDto,
  UpdateProductionOrderDto,
} from '@denimflow/shared';
import { OrderRepository } from './order.repository.js';

@Injectable()
export class OrderService {
  constructor(@Inject(OrderRepository) private readonly orderRepository: OrderRepository) {}

  async listOrders(query?: ProductionOrderQueryDto) {
    return this.orderRepository.listOrders(query);
  }

  async getOrderById(id: string) {
    const order = await this.orderRepository.findOrderById(id);
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }
    return order;
  }

  async createDraftOrder(dto: CreateProductionOrderDto, actorId: string) {
    // BR-17 (data side): forced ppSampleRequired = true when isCustom
    if (dto.isCustom) {
      dto.ppSampleRequired = true;
    }

    return this.orderRepository.createDraftOrder(dto, actorId);
  }

  async updateDraftOrder(id: string, dto: UpdateProductionOrderDto, actorId: string) {
    // BR-17 (data side): forced ppSampleRequired = true when isCustom
    if (dto.isCustom) {
      dto.ppSampleRequired = true;
    }

    return this.orderRepository.updateDraftOrder(id, dto, actorId);
  }
}
