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
    selectFabricColor: ReturnType<typeof vi.fn>;
    calculateAndPersistBom: ReturnType<typeof vi.fn>;
    getBomLines: ReturnType<typeof vi.fn>;
    attachCustomerAcknowledgement: ReturnType<typeof vi.fn>;
    confirmOrder: ReturnType<typeof vi.fn>;
    createHandover: ReturnType<typeof vi.fn>;
    getHandover: ReturnType<typeof vi.fn>;
  };

  const actorId = '11111111-1111-4111-8111-111111111111';
  const styleId = '22222222-2222-4222-8222-222222222222';

  beforeEach(() => {
    repository = {
      listOrders: vi.fn(),
      findOrderById: vi.fn(),
      createDraftOrder: vi.fn(),
      updateDraftOrder: vi.fn(),
      selectFabricColor: vi.fn(),
      calculateAndPersistBom: vi.fn(),
      getBomLines: vi.fn(),
      attachCustomerAcknowledgement: vi.fn(),
      confirmOrder: vi.fn(),
      createHandover: vi.fn(),
      getHandover: vi.fn(),
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

  describe('selectFabricColor', () => {
    it('delegates to repository.selectFabricColor', async () => {
      const dto = {
        fabricTypeId: '11111111-1111-4111-8111-111111111111',
        colorId: '22222222-2222-4222-8222-222222222222',
      };
      repository.selectFabricColor.mockResolvedValue({ id: 'order-1', ...dto });

      const res = await service.selectFabricColor('order-1', dto, actorId);
      expect(res).toEqual(expect.objectContaining({ id: 'order-1' }));
      expect(repository.selectFabricColor).toHaveBeenCalledWith('order-1', dto, actorId);
    });
  });

  describe('calculateAndPersistBom and getBomLines', () => {
    it('delegates calculateAndPersistBom to repository', async () => {
      repository.calculateAndPersistBom.mockResolvedValue([
        { id: 'b-1', materialType: 'FABRIC', requiredQty: 150 },
      ]);
      const res = await service.calculateAndPersistBom('order-1', actorId);
      expect(res).toHaveLength(1);
      expect(repository.calculateAndPersistBom).toHaveBeenCalledWith('order-1', actorId);
    });

    it('delegates getBomLines to repository', async () => {
      repository.getBomLines.mockResolvedValue([
        { id: 'b-1', materialType: 'BUTTON', requiredQty: 50 },
      ]);
      const res = await service.getBomLines('order-1');
      expect(res).toHaveLength(1);
      expect(repository.getBomLines).toHaveBeenCalledWith('order-1');
    });
  });

  describe('attachCustomerAcknowledgement', () => {
    it('delegates to repository.attachCustomerAcknowledgement', async () => {
      const dto = {
        acknowledgedByName: 'Nguyen Van A',
        filePath: 'uploads/ack-123.pdf',
      };
      repository.attachCustomerAcknowledgement.mockResolvedValue({ id: 'ack-1', ...dto });

      const res = await service.attachCustomerAcknowledgement('order-1', dto, actorId);
      expect(res).toEqual(expect.objectContaining({ id: 'ack-1' }));
      expect(repository.attachCustomerAcknowledgement).toHaveBeenCalledWith(
        'order-1',
        dto,
        actorId,
      );
    });
  });

  describe('confirmOrder', () => {
    it('delegates to repository.confirmOrder', async () => {
      repository.confirmOrder.mockResolvedValue({
        success: true,
        orderId: 'order-1',
        status: 'CONFIRMED',
        workflowInstanceId: 'inst-1',
        totalSteps: 10,
        runningStep: 'ORDER_CONFIRM',
        nextStep: 'FABRIC_INSPECT',
      });

      const res = await service.confirmOrder('order-1', actorId);
      expect(res.success).toBe(true);
      expect(res.status).toBe('CONFIRMED');
      expect(repository.confirmOrder).toHaveBeenCalledWith('order-1', actorId);
    });
  });

  describe('createHandover', () => {
    it('delegates to repository.createHandover', async () => {
      const mockHandover = {
        id: 'hand-1',
        orderId: 'order-1',
        orderNumber: 'PO-2026-0001',
        qcProfileId: 'qc-prof-1',
        qcProfileType: 'FULL_PROCESS',
        packingList: [{ size: '30', plannedQty: 100, actualQty: 100 }],
        totalQty: 100,
        handedOverBy: actorId,
        handedOverByName: 'Planner Name',
        handedOverAt: new Date().toISOString(),
        orderStatus: 'COMPLETED',
      };
      repository.createHandover.mockResolvedValue(mockHandover);

      const res = await service.createHandover('order-1', { notes: 'Delivered' }, actorId);
      expect(res).toEqual(mockHandover);
      expect(repository.createHandover).toHaveBeenCalledWith(
        'order-1',
        { notes: 'Delivered' },
        actorId,
      );
    });
  });

  describe('getHandover', () => {
    it('delegates to repository.getHandover', async () => {
      repository.getHandover.mockResolvedValue(null);
      const res = await service.getHandover('order-1');
      expect(res).toBeNull();
      expect(repository.getHandover).toHaveBeenCalledWith('order-1');
    });
  });
});
