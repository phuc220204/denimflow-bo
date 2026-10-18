import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../auth/auth.service.js';
import { OrderController } from './order.controller.js';
import { OrderService } from './order.service.js';

describe('OrderController', () => {
  let controller: OrderController;
  let orderService: {
    listOrders: ReturnType<typeof vi.fn>;
    getOrderById: ReturnType<typeof vi.fn>;
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
  let authService: {
    getMe: ReturnType<typeof vi.fn>;
  };

  const plannerUser = {
    id: 'user-planner',
    email: 'planner@denimflow.test',
    fullName: 'Planner User',
    role: 'PRODUCTION_PLANNER',
    isActive: true,
  };

  const operatorUser = {
    id: 'user-operator',
    email: 'operator@denimflow.test',
    fullName: 'Station Operator',
    role: 'STATION_OPERATOR',
    isActive: true,
  };

  beforeEach(() => {
    orderService = {
      listOrders: vi.fn(),
      getOrderById: vi.fn(),
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
    authService = {
      getMe: vi.fn(),
    };

    controller = new OrderController(
      orderService as unknown as OrderService,
      authService as unknown as AuthService,
    );
  });

  describe('createDraftOrder', () => {
    it('allows PRODUCTION_PLANNER to create a draft order', async () => {
      authService.getMe.mockResolvedValue(plannerUser);
      orderService.createDraftOrder.mockResolvedValue({
        id: 'po-1',
        orderNumber: 'PO-2026-0001',
      });

      const body = {
        styleId: '11111111-1111-4111-8111-111111111111',
        dueDate: '2026-11-15',
        sizeLines: [{ size: '30', plannedQty: 50 }],
      };

      const res = await controller.createDraftOrder(body, 'Bearer token');
      expect(res).toEqual({ id: 'po-1', orderNumber: 'PO-2026-0001' });
      expect(orderService.createDraftOrder).toHaveBeenCalledWith(
        expect.objectContaining({ styleId: body.styleId }),
        plannerUser.id,
      );
    });

    it('rejects STATION_OPERATOR from creating orders', async () => {
      authService.getMe.mockResolvedValue(operatorUser);

      const body = {
        styleId: '11111111-1111-4111-8111-111111111111',
        dueDate: '2026-11-15',
        sizeLines: [{ size: '30', plannedQty: 50 }],
      };

      await expect(controller.createDraftOrder(body, 'Bearer token')).rejects.toThrow(
        ForbiddenException,
      );
      expect(orderService.createDraftOrder).not.toHaveBeenCalled();
    });
  });

  describe('listOrders and getOrderById', () => {
    it('allows authenticated users to view orders', async () => {
      authService.getMe.mockResolvedValue(operatorUser);
      orderService.listOrders.mockResolvedValue([{ id: 'po-1' }]);

      const res = await controller.listOrders({}, 'Bearer token');
      expect(res).toEqual([{ id: 'po-1' }]);
    });

    it('allows authenticated users to view order detail', async () => {
      authService.getMe.mockResolvedValue(operatorUser);
      orderService.getOrderById.mockResolvedValue({ id: 'po-1' });

      const res = await controller.getOrderById('po-1', 'Bearer token');
      expect(res).toEqual({ id: 'po-1' });
    });
  });

  describe('selectFabricColor', () => {
    it('allows planner to select fabric and color', async () => {
      authService.getMe.mockResolvedValue(plannerUser);
      orderService.selectFabricColor.mockResolvedValue({
        id: 'po-1',
        fabricTypeId: '11111111-1111-4111-8111-111111111111',
        colorId: '22222222-2222-4222-8222-222222222222',
      });

      const body = {
        fabricTypeId: '11111111-1111-4111-8111-111111111111',
        colorId: '22222222-2222-4222-8222-222222222222',
      };

      const res = await controller.selectFabricColor('po-1', body, 'Bearer token');
      expect(res).toEqual(expect.objectContaining({ id: 'po-1' }));
      expect(orderService.selectFabricColor).toHaveBeenCalledWith('po-1', body, plannerUser.id);
    });

    it('rejects operator from selecting fabric and color', async () => {
      authService.getMe.mockResolvedValue(operatorUser);

      const body = {
        fabricTypeId: '11111111-1111-4111-8111-111111111111',
        colorId: '22222222-2222-4222-8222-222222222222',
      };

      await expect(controller.selectFabricColor('po-1', body, 'Bearer token')).rejects.toThrow(
        ForbiddenException,
      );
      expect(orderService.selectFabricColor).not.toHaveBeenCalled();
    });
  });

  describe('BOM endpoints', () => {
    it('allows planner to calculate BOM', async () => {
      authService.getMe.mockResolvedValue(plannerUser);
      orderService.calculateAndPersistBom.mockResolvedValue([
        { id: 'bom-1', materialType: 'FABRIC', requiredQty: 100 },
      ]);

      const res = await controller.calculateBom('po-1', 'Bearer token');
      expect(res).toHaveLength(1);
      expect(orderService.calculateAndPersistBom).toHaveBeenCalledWith('po-1', plannerUser.id);
    });

    it('rejects operator from calculating BOM', async () => {
      authService.getMe.mockResolvedValue(operatorUser);

      await expect(controller.calculateBom('po-1', 'Bearer token')).rejects.toThrow(
        ForbiddenException,
      );
      expect(orderService.calculateAndPersistBom).not.toHaveBeenCalled();
    });

    it('allows authenticated user to get BOM lines', async () => {
      authService.getMe.mockResolvedValue(operatorUser);
      orderService.getBomLines.mockResolvedValue([
        { id: 'bom-1', materialType: 'THREAD', requiredQty: 500 },
      ]);

      const res = await controller.getBomLines('po-1', 'Bearer token');
      expect(res).toHaveLength(1);
      expect(orderService.getBomLines).toHaveBeenCalledWith('po-1');
    });
  });

  describe('attachAcknowledgement', () => {
    it('allows planner to attach customer acknowledgement', async () => {
      authService.getMe.mockResolvedValue(plannerUser);
      orderService.attachCustomerAcknowledgement.mockResolvedValue({
        id: 'ack-1',
        acknowledgedByName: 'Nguyen Van A',
      });

      const body = {
        acknowledgedByName: 'Nguyen Van A',
        filePath: 'uploads/ack-signed.pdf',
      };

      const res = await controller.attachAcknowledgement('po-1', body, 'Bearer token');
      expect(res).toEqual(expect.objectContaining({ id: 'ack-1' }));
      expect(orderService.attachCustomerAcknowledgement).toHaveBeenCalledWith(
        'po-1',
        expect.objectContaining(body),
        plannerUser.id,
      );
    });

    it('rejects operator from attaching acknowledgement', async () => {
      authService.getMe.mockResolvedValue(operatorUser);

      const body = {
        acknowledgedByName: 'Nguyen Van A',
        filePath: 'uploads/ack-signed.pdf',
      };

      await expect(controller.attachAcknowledgement('po-1', body, 'Bearer token')).rejects.toThrow(
        ForbiddenException,
      );
      expect(orderService.attachCustomerAcknowledgement).not.toHaveBeenCalled();
    });
  });

  describe('confirmOrder', () => {
    it('allows planner to confirm order', async () => {
      authService.getMe.mockResolvedValue(plannerUser);
      orderService.confirmOrder.mockResolvedValue({
        success: true,
        orderId: 'po-1',
        status: 'CONFIRMED',
      });

      const res = await controller.confirmOrder('po-1', 'Bearer token');
      expect(res).toEqual(expect.objectContaining({ success: true, status: 'CONFIRMED' }));
      expect(orderService.confirmOrder).toHaveBeenCalledWith('po-1', plannerUser.id);
    });

    it('rejects operator from confirming order', async () => {
      authService.getMe.mockResolvedValue(operatorUser);

      await expect(controller.confirmOrder('po-1', 'Bearer token')).rejects.toThrow(
        ForbiddenException,
      );
      expect(orderService.confirmOrder).not.toHaveBeenCalled();
    });
  });

  describe('createHandover (FR-26)', () => {
    it('allows planner to create handover record', async () => {
      authService.getMe.mockResolvedValue(plannerUser);
      const mockResult = {
        id: 'hand-1',
        orderId: 'po-1',
        orderNumber: 'PO-2026-0001',
        qcProfileId: 'prof-1',
        qcProfileType: 'FULL_PROCESS',
        packingList: [],
        totalQty: 100,
        handedOverBy: plannerUser.id,
        handedOverByName: 'Planner User',
        handedOverAt: new Date().toISOString(),
        orderStatus: 'COMPLETED',
      };
      orderService.createHandover.mockResolvedValue(mockResult);

      const res = await controller.createHandover('po-1', { notes: 'Pack OK' }, 'Bearer token');
      expect(res).toEqual(mockResult);
      expect(orderService.createHandover).toHaveBeenCalledWith(
        'po-1',
        { notes: 'Pack OK' },
        plannerUser.id,
      );
    });

    it('rejects operator from creating handover record', async () => {
      authService.getMe.mockResolvedValue(operatorUser);

      await expect(controller.createHandover('po-1', {}, 'Bearer token')).rejects.toThrow(
        ForbiddenException,
      );
      expect(orderService.createHandover).not.toHaveBeenCalled();
    });
  });

  describe('getHandover', () => {
    it('delegates to orderService.getHandover for authenticated user', async () => {
      authService.getMe.mockResolvedValue(operatorUser);
      orderService.getHandover.mockResolvedValue(null);

      const res = await controller.getHandover('po-1', 'Bearer token');
      expect(res).toBeNull();
      expect(orderService.getHandover).toHaveBeenCalledWith('po-1');
    });
  });
});
