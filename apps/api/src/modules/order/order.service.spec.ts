import {
  type CreateProductionOrderDto,
  OrderStatus,
  type UpdateProductionOrderDto,
} from '@denimflow/shared';
import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderRepository } from './order.repository.js';
import { OrderService } from './order.service.js';

describe('OrderService', () => {
  let service: OrderService;
  let repository: {
    listOrders: ReturnType<typeof vi.fn>;
    findOrderById: ReturnType<typeof vi.fn>;
    createDraftOrder: ReturnType<typeof vi.fn>;
    updateDraftOrder: ReturnType<typeof vi.fn>;
  };

  const actorId = '11111111-1111-4111-8111-111111111111';
  const styleId = '22222222-2222-4222-8222-222222222222';

  beforeEach(() => {
    repository = {
      listOrders: vi.fn(),
      findOrderById: vi.fn(),
      createDraftOrder: vi.fn(),
      updateDraftOrder: vi.fn(),
    };
    service = new OrderService(repository as unknown as OrderRepository);
  });

  describe('createDraftOrder', () => {
    it('creates a draft order and delegates to repository', async () => {
      const dto = {
        styleId,
        dueDate: '2026-11-20',
        customerRef: 'CUST-001',
        sizeLines: [{ size: '30', plannedQty: 100 }],
      };
      repository.createDraftOrder.mockResolvedValue({
        id: 'order-1',
        orderNumber: 'PO-2026-0001',
        status: 'DRAFT',
      });

      const result = await service.createDraftOrder(
        dto as unknown as CreateProductionOrderDto,
        actorId,
      );
      expect(result).toEqual(expect.objectContaining({ orderNumber: 'PO-2026-0001' }));
      expect(repository.createDraftOrder).toHaveBeenCalledWith(
        expect.objectContaining({ styleId }),
        actorId,
      );
    });

    it('enforces BR-17: forces ppSampleRequired = true when isCustom is true', async () => {
      const dto = {
        styleId,
        dueDate: '2026-11-20',
        isCustom: true,
        ppSampleRequired: false,
        sizeLines: [{ size: '32', plannedQty: 200 }],
      };
      repository.createDraftOrder.mockResolvedValue({ id: 'order-custom' });

      await service.createDraftOrder(dto as unknown as CreateProductionOrderDto, actorId);
      expect(dto.ppSampleRequired).toBe(true);
      expect(repository.createDraftOrder).toHaveBeenCalledWith(
        expect.objectContaining({ isCustom: true, ppSampleRequired: true }),
        actorId,
      );
    });
  });

  describe('updateDraftOrder', () => {
    it('enforces BR-17 on update and delegates to repository', async () => {
      const dto = {
        isCustom: true,
        ppSampleRequired: false,
      };
      repository.updateDraftOrder.mockResolvedValue({ id: 'order-1', isCustom: true });

      await service.updateDraftOrder(
        'order-1',
        dto as unknown as UpdateProductionOrderDto,
        actorId,
      );
      expect(dto.ppSampleRequired).toBe(true);
      expect(repository.updateDraftOrder).toHaveBeenCalledWith(
        'order-1',
        expect.objectContaining({ isCustom: true, ppSampleRequired: true }),
        actorId,
      );
    });
  });

  describe('getOrderById', () => {
    it('returns the order when found', async () => {
      repository.findOrderById.mockResolvedValue({ id: 'order-1', orderNumber: 'PO-2026-0001' });
      const order = await service.getOrderById('order-1');
      expect(order.orderNumber).toBe('PO-2026-0001');
    });

    it('throws NotFoundException when order does not exist', async () => {
      repository.findOrderById.mockResolvedValue(null);
      await expect(service.getOrderById('unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('listOrders', () => {
    it('delegates query to repository', async () => {
      repository.listOrders.mockResolvedValue([{ id: 'order-1' }]);
      const res = await service.listOrders({ status: OrderStatus.DRAFT });
      expect(res).toHaveLength(1);
      expect(repository.listOrders).toHaveBeenCalledWith({ status: OrderStatus.DRAFT });
    });
  });
});
