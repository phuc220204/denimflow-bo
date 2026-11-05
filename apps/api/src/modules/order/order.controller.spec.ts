import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants.js';
import { Role } from '@denimflow/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthGuard } from '../auth/auth.guard.js';
import type { AuthResponse } from '../auth/auth.service.js';
import { ROLES_KEY } from '../auth/roles.decorator.js';
import { OrderController } from './order.controller.js';
import type { OrderService } from './order.service.js';

const rolesOf = (method: keyof OrderController): unknown =>
  Reflect.getMetadata(ROLES_KEY, OrderController.prototype[method]);

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
  };

  const plannerUser: AuthResponse['user'] = {
    id: 'user-planner',
    email: 'planner@denimflow.test',
    fullName: 'Planner User',
    role: 'PRODUCTION_PLANNER',
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
    };
    controller = new OrderController(orderService as unknown as OrderService);
  });

  describe('access rules', () => {
    it('every route requires a login', () => {
      expect(Reflect.getMetadata(GUARDS_METADATA, OrderController)).toEqual([AuthGuard]);
    });

    it('read routes are open to any active user', () => {
      for (const method of ['listOrders', 'getOrderById', 'getBomLines'] as const) {
        expect(rolesOf(method)).toBeUndefined();
      }
    });

    it('write routes are limited to Planner, Admin and Manager', () => {
      for (const method of [
        'createDraftOrder',
        'updateDraftOrder',
        'selectFabricColor',
        'calculateBom',
        'attachAcknowledgement',
        'confirmOrder',
      ] as const) {
        expect(rolesOf(method)).toEqual([Role.PRODUCTION_PLANNER, Role.ADMIN, Role.MANAGER]);
      }
    });
  });

  describe('createDraftOrder', () => {
    it('passes the verified planner id as the actor', async () => {
      orderService.createDraftOrder.mockResolvedValue({
        id: 'po-1',
        orderNumber: 'PO-2026-0001',
      });

      const body = {
        styleId: '11111111-1111-4111-8111-111111111111',
        dueDate: '2026-11-15',
        sizeLines: [{ size: '30', plannedQty: 50 }],
      };

      const res = await controller.createDraftOrder(body, plannerUser);
      expect(res).toEqual({ id: 'po-1', orderNumber: 'PO-2026-0001' });
      expect(orderService.createDraftOrder).toHaveBeenCalledWith(
        expect.objectContaining({ styleId: body.styleId }),
        plannerUser.id,
      );
    });
  });

  describe('listOrders and getOrderById', () => {
    it('returns the order list', async () => {
      orderService.listOrders.mockResolvedValue([{ id: 'po-1' }]);

      const res = await controller.listOrders({});
      expect(res).toEqual([{ id: 'po-1' }]);
    });

    it('returns the order detail', async () => {
      orderService.getOrderById.mockResolvedValue({ id: 'po-1' });

      const res = await controller.getOrderById('po-1');
      expect(res).toEqual({ id: 'po-1' });
    });
  });

  describe('selectFabricColor', () => {
    it('passes the verified planner id as the actor', async () => {
      orderService.selectFabricColor.mockResolvedValue({ id: 'po-1' });

      const body = {
        fabricTypeId: '11111111-1111-4111-8111-111111111111',
        colorId: '22222222-2222-4222-8222-222222222222',
      };

      const res = await controller.selectFabricColor('po-1', body, plannerUser);
      expect(res).toEqual(expect.objectContaining({ id: 'po-1' }));
      expect(orderService.selectFabricColor).toHaveBeenCalledWith('po-1', body, plannerUser.id);
    });
  });

  describe('BOM endpoints', () => {
    it('passes the verified planner id when calculating the BOM', async () => {
      orderService.calculateAndPersistBom.mockResolvedValue([
        { id: 'bom-1', materialType: 'FABRIC', requiredQty: 100 },
      ]);

      const res = await controller.calculateBom('po-1', plannerUser);
      expect(res).toHaveLength(1);
      expect(orderService.calculateAndPersistBom).toHaveBeenCalledWith('po-1', plannerUser.id);
    });

    it('returns the BOM lines', async () => {
      orderService.getBomLines.mockResolvedValue([
        { id: 'bom-1', materialType: 'THREAD', requiredQty: 500 },
      ]);

      const res = await controller.getBomLines('po-1');
      expect(res).toHaveLength(1);
      expect(orderService.getBomLines).toHaveBeenCalledWith('po-1');
    });
  });

  describe('attachAcknowledgement', () => {
    it('passes the verified planner id as the actor', async () => {
      orderService.attachCustomerAcknowledgement.mockResolvedValue({
        id: 'ack-1',
        acknowledgedByName: 'Nguyen Van A',
      });

      const body = {
        acknowledgedByName: 'Nguyen Van A',
        filePath: 'uploads/ack-signed.pdf',
      };

      const res = await controller.attachAcknowledgement('po-1', body, plannerUser);
      expect(res).toEqual(expect.objectContaining({ id: 'ack-1' }));
      expect(orderService.attachCustomerAcknowledgement).toHaveBeenCalledWith(
        'po-1',
        expect.objectContaining(body),
        plannerUser.id,
      );
    });
  });

  describe('confirmOrder', () => {
    it('passes the verified planner id as the actor', async () => {
      orderService.confirmOrder.mockResolvedValue({
        success: true,
        orderId: 'po-1',
        status: 'CONFIRMED',
      });

      const res = await controller.confirmOrder('po-1', plannerUser);
      expect(res).toEqual(expect.objectContaining({ success: true, status: 'CONFIRMED' }));
      expect(orderService.confirmOrder).toHaveBeenCalledWith('po-1', plannerUser.id);
    });
  });
});
