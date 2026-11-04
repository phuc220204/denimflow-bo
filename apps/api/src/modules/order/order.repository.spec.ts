import type { Prisma } from '../../generated/prisma/client.js';
import type { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { OrderRepository } from './order.repository.js';

describe('OrderRepository', () => {
  it('generates order number PO-YYYY-0001 when no previous orders exist', async () => {
    const mockPrisma = {
      productionOrder: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };

    const repo = new OrderRepository(mockPrisma as unknown as PrismaService);
    const tx = mockPrisma as unknown as Prisma.TransactionClient;

    const orderNumber = await repo.generateOrderNumber(tx, 2026);
    expect(orderNumber).toBe('PO-2026-0001');
  });

  it('generates sequential order number PO-YYYY-NNNN based on latest order', async () => {
    const mockPrisma = {
      productionOrder: {
        findFirst: vi.fn().mockResolvedValue({ orderNumber: 'PO-2026-0042' }),
      },
    };

    const repo = new OrderRepository(mockPrisma as unknown as PrismaService);
    const tx = mockPrisma as unknown as Prisma.TransactionClient;

    const orderNumber = await repo.generateOrderNumber(tx, 2026);
    expect(orderNumber).toBe('PO-2026-0043');
  });

  describe('selectFabricColor (BR-04, BR-05)', () => {
    const actorId = '11111111-1111-4111-8111-111111111111';
    const orderId = 'order-123';
    const fabricTypeId = 'fab-1';
    const colorId = 'col-1';

    it('BR-05: rejects fabric/color change once CUTTING has started', async () => {
      const existingOrder = {
        id: orderId,
        status: 'CONFIRMED',
        fabricTypeId: 'fab-old',
        colorId: 'col-old',
        washTypeId: null,
        workflowInstance: {
          stepInstances: [
            {
              stepDefinition: { code: 'CUTTING' },
              status: 'IN_PROGRESS',
            },
          ],
        },
      };

      const txMock = {
        productionOrder: {
          findUnique: vi.fn().mockResolvedValue(existingOrder),
        },
      };

      const mockPrisma = {
        $transaction: vi.fn((cb: (tx: unknown) => unknown) => cb(txMock)),
      };

      const repo = new OrderRepository(mockPrisma as unknown as PrismaService);

      await expect(
        repo.selectFabricColor(orderId, { fabricTypeId, colorId }, actorId),
      ).rejects.toThrow('BR-05: Fabric, color and wash are locked once CUTTING has started');
    });

    it('BR-05: rejects fabric/color change when order status is IN_PRODUCTION', async () => {
      const existingOrder = {
        id: orderId,
        status: 'IN_PRODUCTION',
        fabricTypeId: 'fab-old',
        colorId: 'col-old',
        washTypeId: null,
        workflowInstance: null,
      };

      const txMock = {
        productionOrder: {
          findUnique: vi.fn().mockResolvedValue(existingOrder),
        },
      };

      const mockPrisma = {
        $transaction: vi.fn((cb: (tx: unknown) => unknown) => cb(txMock)),
      };

      const repo = new OrderRepository(mockPrisma as unknown as PrismaService);

      await expect(
        repo.selectFabricColor(orderId, { fabricTypeId, colorId }, actorId),
      ).rejects.toThrow('BR-05: Fabric, color and wash are locked once CUTTING has started');
    });

    it('BR-04: rejects invalid fabric and color pair per compatibility matrix', async () => {
      const existingOrder = {
        id: orderId,
        status: 'DRAFT',
        fabricTypeId: 'fab-old',
        colorId: 'col-old',
        washTypeId: null,
        workflowInstance: {
          stepInstances: [
            {
              stepDefinition: { code: 'CUTTING' },
              status: 'PENDING',
            },
          ],
        },
      };

      const txMock = {
        productionOrder: {
          findUnique: vi.fn().mockResolvedValue(existingOrder),
        },
        fabricColorRule: {
          findUnique: vi.fn().mockResolvedValue({ isAllowed: false }),
        },
      };

      const mockPrisma = {
        $transaction: vi.fn((cb: (tx: unknown) => unknown) => cb(txMock)),
      };

      const repo = new OrderRepository(mockPrisma as unknown as PrismaService);

      await expect(
        repo.selectFabricColor(orderId, { fabricTypeId, colorId }, actorId),
      ).rejects.toThrow(
        'BR-04: Selected fabric and color pair is not allowed per compatibility matrix',
      );
    });

    it('BR-04: allows valid fabric and color pair per compatibility matrix and creates audit log', async () => {
      const existingOrder = {
        id: orderId,
        status: 'DRAFT',
        fabricTypeId: 'fab-old',
        colorId: 'col-old',
        washTypeId: null,
        workflowInstance: {
          stepInstances: [
            {
              stepDefinition: { code: 'CUTTING' },
              status: 'READY',
            },
          ],
        },
      };

      const updatedOrder = {
        ...existingOrder,
        fabricTypeId,
        colorId,
        version: 2,
      };

      const txMock = {
        productionOrder: {
          findUnique: vi.fn().mockResolvedValue(existingOrder),
          update: vi.fn().mockResolvedValue(updatedOrder),
        },
        fabricColorRule: {
          findUnique: vi.fn().mockResolvedValue({ isAllowed: true }),
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
        },
      };

      const mockPrisma = {
        $transaction: vi.fn((cb: (tx: unknown) => unknown) => cb(txMock)),
      };

      const repo = new OrderRepository(mockPrisma as unknown as PrismaService);

      const result = await repo.selectFabricColor(orderId, { fabricTypeId, colorId }, actorId);
      expect(result).toEqual(updatedOrder);
      expect(txMock.productionOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: orderId },
          data: expect.objectContaining({ fabricTypeId, colorId }),
        }),
      );
      expect(txMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'SELECT_FABRIC_COLOR',
            actorId,
          }),
        }),
      );
    });
  });

  describe('calculateAndPersistBom and getBomLines', () => {
    const actorId = '11111111-1111-4111-8111-111111111111';
    const orderId = 'order-bom-123';

    it('calculates and persists BOM lines using size-norm strategy and creates AuditLog', async () => {
      const order = {
        id: orderId,
        sizeLines: [
          { size: '29', plannedQty: 100 },
          { size: '30', plannedQty: 150 },
        ],
        style: {
          styleCode: 'JS-01',
          bomNorms: [
            {
              size: '29',
              materialType: 'FABRIC',
              qtyPerPiece: 1.35,
              unit: 'meter',
              wastagePercent: 5,
            },
            {
              size: '30',
              materialType: 'FABRIC',
              qtyPerPiece: 1.4,
              unit: 'meter',
              wastagePercent: 5,
            },
            {
              size: 'ALL',
              materialType: 'BUTTON',
              qtyPerPiece: 1,
              unit: 'piece',
              wastagePercent: 2,
            },
          ],
        },
      };

      const persistedLines = [
        { id: 'b-1', orderId, materialType: 'BUTTON', requiredQty: 255, unit: 'piece' },
        { id: 'b-2', orderId, materialType: 'FABRIC', requiredQty: 362.25, unit: 'meter' },
      ];

      const txMock = {
        productionOrder: {
          findUnique: vi.fn().mockResolvedValue(order),
        },
        bomLine: {
          deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
          createMany: vi.fn().mockResolvedValue({ count: 2 }),
          findMany: vi.fn().mockResolvedValue(persistedLines),
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
        },
      };

      const mockPrisma = {
        $transaction: vi.fn((cb: (tx: unknown) => unknown) => cb(txMock)),
      };

      const repo = new OrderRepository(mockPrisma as unknown as PrismaService);
      const result = await repo.calculateAndPersistBom(orderId, actorId);

      expect(result).toEqual(persistedLines);
      expect(txMock.bomLine.deleteMany).toHaveBeenCalledWith({ where: { orderId } });
      expect(txMock.bomLine.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ materialType: 'FABRIC', requiredQty: 362.25 }),
            expect.objectContaining({ materialType: 'BUTTON', requiredQty: 255 }),
          ]),
        }),
      );
      expect(txMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'CALCULATE_BOM',
            actorId,
          }),
        }),
      );
    });

    it('rejects BOM calculation if order has no size lines', async () => {
      const order = {
        id: orderId,
        sizeLines: [],
        style: {
          styleCode: 'JS-01',
          bomNorms: [{ size: '30', materialType: 'FABRIC', qtyPerPiece: 1.4, unit: 'meter' }],
        },
      };

      const txMock = {
        productionOrder: {
          findUnique: vi.fn().mockResolvedValue(order),
        },
      };

      const mockPrisma = {
        $transaction: vi.fn((cb: (tx: unknown) => unknown) => cb(txMock)),
      };

      const repo = new OrderRepository(mockPrisma as unknown as PrismaService);
      await expect(repo.calculateAndPersistBom(orderId, actorId)).rejects.toThrow(
        'Đơn hàng chưa có dải cỡ (size lines) để tính BOM',
      );
    });

    it('rejects BOM calculation if style has no BOM norms', async () => {
      const order = {
        id: orderId,
        sizeLines: [{ size: '30', plannedQty: 100 }],
        style: {
          styleCode: 'JS-01',
          bomNorms: [],
        },
      };

      const txMock = {
        productionOrder: {
          findUnique: vi.fn().mockResolvedValue(order),
        },
      };

      const mockPrisma = {
        $transaction: vi.fn((cb: (tx: unknown) => unknown) => cb(txMock)),
      };

      const repo = new OrderRepository(mockPrisma as unknown as PrismaService);
      await expect(repo.calculateAndPersistBom(orderId, actorId)).rejects.toThrow(
        'chưa được cấu hình định mức BOM',
      );
    });

    it('getBomLines returns persisted BOM lines for order', async () => {
      const mockPrisma = {
        productionOrder: {
          findUnique: vi.fn().mockResolvedValue({ id: orderId }),
        },
        bomLine: {
          findMany: vi.fn().mockResolvedValue([{ id: 'b-1', materialType: 'FABRIC' }]),
        },
      };

      const repo = new OrderRepository(mockPrisma as unknown as PrismaService);
      const lines = await repo.getBomLines(orderId);
      expect(lines).toHaveLength(1);
      expect(mockPrisma.bomLine.findMany).toHaveBeenCalledWith({
        where: { orderId },
        orderBy: { materialType: 'asc' },
      });
    });
  });

  describe('attachCustomerAcknowledgement (BR-19)', () => {
    const actorId = '11111111-1111-4111-8111-111111111111';
    const orderId = 'order-123';
    const styleId = 'style-123';

    it('creates CustomerAcknowledgement record and logs audit', async () => {
      const txMock = {
        productionOrder: {
          findUnique: vi.fn().mockResolvedValue({ id: orderId, styleId }),
        },
        qcProfile: {
          findUnique: vi.fn().mockResolvedValue({ id: 'qc-profile-1' }),
          create: vi.fn(),
        },
        customerAcknowledgement: {
          create: vi.fn().mockResolvedValue({
            id: 'ack-1',
            orderId,
            ackType: 'SKIP_CLEAN_WASH',
            filePath: 'uploads/ack.pdf',
            acknowledgedByName: 'Customer A',
          }),
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({ id: 'audit-ack' }),
        },
      };

      const mockPrisma = {
        $transaction: vi.fn((cb: (tx: unknown) => unknown) => cb(txMock)),
      };

      const repo = new OrderRepository(mockPrisma as unknown as PrismaService);
      const result = await repo.attachCustomerAcknowledgement(
        orderId,
        {
          filePath: 'uploads/ack.pdf',
          acknowledgedByName: 'Customer A',
        },
        actorId,
      );

      expect(result.id).toBe('ack-1');
      expect(txMock.customerAcknowledgement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orderId,
            ackType: 'SKIP_CLEAN_WASH',
            filePath: 'uploads/ack.pdf',
            acknowledgedByName: 'Customer A',
          }),
        }),
      );
      expect(txMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'ATTACH_CUSTOMER_ACKNOWLEDGEMENT',
            actorId,
          }),
        }),
      );
    });
  });

  describe('confirmOrder (FR-07, FR-11, BR-03, BR-16, BR-17, BR-18, BR-19)', () => {
    const actorId = '11111111-1111-4111-8111-111111111111';
    const orderId = 'order-123';
    const styleId = 'style-123';
    const templateId = 'tpl-1';
    const versionId = 'ver-1';

    const baseOrderRow = {
      id: orderId,
      order_number: 'PO-2026-0001',
      status: 'DRAFT',
      style_id: styleId,
      fabric_type_id: 'fab-1',
      color_id: 'col-1',
      wash_type_id: null,
      is_custom: false,
      skip_clean_wash: false,
      pp_sample_required: false,
      dye_required: false,
      dye_mode: null,
      dye_source: null,
      embroidery_required: false,
      fabric_inspect_required: true,
    };

    const mockSteps = [
      {
        id: 's-1',
        code: 'ORDER_CONFIRM',
        name: 'Order Confirm',
        seq: 10,
        isStart: true,
        isEnd: false,
        isMandatory: true,
        conditionExpr: null,
      },
      {
        id: 's-2',
        code: 'FABRIC_INSPECT',
        name: 'Fabric Inspect',
        seq: 20,
        isStart: false,
        isEnd: false,
        isMandatory: false,
        conditionExpr: { op: 'eq', field: 'order.fabricInspectRequired', value: true },
      },
      {
        id: 's-3',
        code: 'CUTTING',
        name: 'Cutting',
        seq: 30,
        isStart: false,
        isEnd: false,
        isMandatory: true,
        conditionExpr: null,
      },
      {
        id: 's-4',
        code: 'SEWING',
        name: 'Sewing',
        seq: 40,
        isStart: false,
        isEnd: false,
        isMandatory: true,
        conditionExpr: null,
      },
      {
        id: 's-5',
        code: 'CLEAN_WASH',
        name: 'Clean Wash',
        seq: 50,
        isStart: false,
        isEnd: false,
        isMandatory: false,
        conditionExpr: { op: 'eq', field: 'order.skipCleanWash', value: false },
      },
    ];

    it('BR-17: rejects confirmation if order isCustom is true', async () => {
      const txMock = {
        $queryRaw: vi.fn().mockResolvedValue([{ ...baseOrderRow, is_custom: true }]),
      };
      const mockPrisma = {
        $transaction: vi.fn((cb: (tx: unknown) => unknown) => cb(txMock)),
      };
      const repo = new OrderRepository(mockPrisma as unknown as PrismaService);

      await expect(repo.confirmOrder(orderId, actorId)).rejects.toThrow('BR-17');
    });

    it('rejects confirmation if order is not in DRAFT status', async () => {
      const txMock = {
        $queryRaw: vi.fn().mockResolvedValue([{ ...baseOrderRow, status: 'CONFIRMED' }]),
      };
      const mockPrisma = {
        $transaction: vi.fn((cb: (tx: unknown) => unknown) => cb(txMock)),
      };
      const repo = new OrderRepository(mockPrisma as unknown as PrismaService);

      await expect(repo.confirmOrder(orderId, actorId)).rejects.toThrow(
        'không thể xác nhận (chỉ áp dụng cho DRAFT)',
      );
    });

    it('rejects confirmation if order has no size lines', async () => {
      const txMock = {
        $queryRaw: vi.fn().mockResolvedValue([baseOrderRow]),
        orderSizeLine: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      };
      const mockPrisma = {
        $transaction: vi.fn((cb: (tx: unknown) => unknown) => cb(txMock)),
      };
      const repo = new OrderRepository(mockPrisma as unknown as PrismaService);

      await expect(repo.confirmOrder(orderId, actorId)).rejects.toThrow('ít nhất 1 cỡ');
    });

    it('BR-03: rejects confirmation if style has no default template or no PUBLISHED version', async () => {
      const txMock = {
        $queryRaw: vi.fn().mockResolvedValue([baseOrderRow]),
        orderSizeLine: {
          findMany: vi.fn().mockResolvedValue([{ size: '30', plannedQty: 100 }]),
        },
        style: {
          findUnique: vi
            .fn()
            .mockResolvedValue({ id: styleId, styleCode: 'JS-01', defaultTemplateId: templateId }),
        },
        workflowVersion: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      };
      const mockPrisma = {
        $transaction: vi.fn((cb: (tx: unknown) => unknown) => cb(txMock)),
      };
      const repo = new OrderRepository(mockPrisma as unknown as PrismaService);

      await expect(repo.confirmOrder(orderId, actorId)).rejects.toThrow('BR-03');
    });

    it('BR-19: rejects confirmation if skipCleanWash is true but CustomerAcknowledgement is missing', async () => {
      const txMock = {
        $queryRaw: vi.fn().mockResolvedValue([{ ...baseOrderRow, skip_clean_wash: true }]),
        orderSizeLine: {
          findMany: vi.fn().mockResolvedValue([{ size: '30', plannedQty: 100 }]),
        },
        style: {
          findUnique: vi
            .fn()
            .mockResolvedValue({ id: styleId, styleCode: 'JS-01', defaultTemplateId: templateId }),
        },
        workflowVersion: {
          findFirst: vi.fn().mockResolvedValue({
            id: versionId,
            versionNo: 1,
            steps: mockSteps,
          }),
        },
        customerAcknowledgement: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      };
      const mockPrisma = {
        $transaction: vi.fn((cb: (tx: unknown) => unknown) => cb(txMock)),
      };
      const repo = new OrderRepository(mockPrisma as unknown as PrismaService);

      await expect(repo.confirmOrder(orderId, actorId)).rejects.toThrow('BR-19');
    });

    it('successfully confirms order, creates workflow instance snapshot and audit logs', async () => {
      const txMock = {
        $queryRaw: vi.fn().mockResolvedValue([{ ...baseOrderRow, skip_clean_wash: true }]),
        orderSizeLine: {
          findMany: vi.fn().mockResolvedValue([{ size: '30', plannedQty: 100 }]),
        },
        style: {
          findUnique: vi
            .fn()
            .mockResolvedValue({ id: styleId, styleCode: 'JS-01', defaultTemplateId: templateId }),
        },
        workflowVersion: {
          findFirst: vi.fn().mockResolvedValue({
            id: versionId,
            versionNo: 1,
            steps: mockSteps,
          }),
        },
        customerAcknowledgement: {
          findFirst: vi.fn().mockResolvedValue({ id: 'ack-1' }),
        },
        qcProfile: {
          findUnique: vi.fn().mockResolvedValue({ id: 'qc-skip' }),
        },
        workflowInstance: {
          create: vi
            .fn()
            .mockResolvedValue({ id: 'inst-1', orderId, versionId, status: 'RUNNING' }),
        },
        stepInstance: {
          create: vi.fn().mockResolvedValue({ id: 'step-inst-x' }),
        },
        productionOrder: {
          update: vi.fn().mockResolvedValue({ id: orderId, status: 'CONFIRMED' }),
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({ id: 'audit-confirm' }),
        },
      };

      const mockPrisma = {
        $transaction: vi.fn((cb: (tx: unknown) => unknown) => cb(txMock)),
      };

      const repo = new OrderRepository(mockPrisma as unknown as PrismaService);
      const result = await repo.confirmOrder(orderId, actorId);

      expect(result.success).toBe(true);
      expect(result.status).toBe('CONFIRMED');
      expect(result.workflowInstanceId).toBe('inst-1');
      expect(result.firstReadyStepCode).toBe('FABRIC_INSPECT');
      expect(result.skippedStepCodes).toContain('CLEAN_WASH');

      // Verify workflowInstance created
      expect(txMock.workflowInstance.create).toHaveBeenCalledWith({
        data: {
          orderId,
          versionId,
          status: 'RUNNING',
        },
      });

      // Verify step instances created (5 steps: ORDER_CONFIRM=DONE, FABRIC_INSPECT=READY, CUTTING=PENDING, SEWING=PENDING, CLEAN_WASH=SKIPPED)
      expect(txMock.stepInstance.create).toHaveBeenCalledTimes(5);
      expect(txMock.stepInstance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stepDefinitionId: 's-1',
            status: 'DONE',
          }),
        }),
      );
      expect(txMock.stepInstance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stepDefinitionId: 's-2',
            status: 'READY',
          }),
        }),
      );
      expect(txMock.stepInstance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stepDefinitionId: 's-5',
            status: 'SKIPPED',
          }),
        }),
      );

      // Verify order update status = CONFIRMED
      expect(txMock.productionOrder.update).toHaveBeenCalledWith({
        where: { id: orderId },
        data: {
          status: 'CONFIRMED',
          qcProfileId: 'qc-skip',
        },
      });

      // Verify audit logs written (CONFIRM_ORDER + SKIP_CLEAN_WASH)
      expect(txMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'CONFIRM_ORDER',
            actorId,
          }),
        }),
      );
      expect(txMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'SKIP_CLEAN_WASH',
            actorId,
          }),
        }),
      );
    });
  });
});
