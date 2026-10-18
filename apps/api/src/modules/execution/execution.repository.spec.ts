import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessRuleViolation } from '../../common/errors/business-rule-violation.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { ExecutionRepository } from './execution.repository.js';

describe('ExecutionRepository', () => {
  let repository: ExecutionRepository;
  let prisma: {
    profile: {
      findUnique: ReturnType<typeof vi.fn>;
    };
    stepInstance: {
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
    evidence: {
      count: ReturnType<typeof vi.fn>;
    };
    productionOrder: {
      update: ReturnType<typeof vi.fn>;
    };
    workflowInstance: {
      update: ReturnType<typeof vi.fn>;
    };
    auditLog: {
      create: ReturnType<typeof vi.fn>;
    };
    stepQuantityEntry: {
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
    bundle: {
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    $executeRaw: ReturnType<typeof vi.fn>;
    $transaction: ReturnType<typeof vi.fn>;
  };

  const cuttingStation = {
    id: 'station-cutting-1',
    code: 'ST-CUT',
    name: 'Cutting Station 1',
    stationType: 'CUTTING',
  };

  const cuttingOperator = {
    id: 'user-op-cut',
    email: 'opcut@denimflow.test',
    fullName: 'Cutting Operator',
    role: 'STATION_OPERATOR',
    stationId: cuttingStation.id,
    station: cuttingStation,
  };

  beforeEach(() => {
    prisma = {
      profile: {
        findUnique: vi.fn(),
      },
      stepInstance: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      evidence: {
        count: vi.fn(),
      },
      productionOrder: {
        update: vi.fn(),
      },
      workflowInstance: {
        update: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      stepQuantityEntry: {
        findMany: vi.fn(),
        create: vi.fn(),
      },
      bundle: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      $executeRaw: vi.fn().mockResolvedValue(1),
      $transaction: vi.fn().mockImplementation(async (cb) => cb(prisma)),
    };

    repository = new ExecutionRepository(prisma as unknown as PrismaService);
  });

  describe('getWorklist (FR-12)', () => {
    it('throws NotFoundException if user profile does not exist', async () => {
      prisma.profile.findUnique.mockResolvedValue(null);
      await expect(repository.getWorklist('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('returns empty list for station operator without an assigned station', async () => {
      prisma.profile.findUnique.mockResolvedValue({
        id: 'op-no-station',
        role: 'STATION_OPERATOR',
        station: null,
      });

      const list = await repository.getWorklist('op-no-station');
      expect(list).toEqual([]);
      expect(prisma.stepInstance.findMany).not.toHaveBeenCalled();
    });

    it('FR-12: station operator sees only steps matching their station type', async () => {
      prisma.profile.findUnique.mockResolvedValue(cuttingOperator);
      prisma.stepInstance.findMany.mockResolvedValue([
        {
          id: 'step-cut-1',
          instanceId: 'inst-1',
          status: 'READY',
          qtyIn: null,
          qtyGood: null,
          qtyDefect: null,
          startedAt: null,
          completedAt: null,
          performedBy: null,
          reworkCount: 0,
          stepDefinition: {
            code: 'CUTTING',
            name: 'Cutting',
            stepType: 'PRODUCTION',
            stationType: 'CUTTING',
            responsibleRole: 'STATION_OPERATOR',
            isMandatory: true,
            requiresEvidence: false,
            requiresQc: false,
            seq: 60,
          },
          instance: {
            order: {
              id: 'ord-1',
              orderNumber: 'PO-20261018-001',
              style: {
                styleCode: 'JN-SLIM-01',
                name: 'Slim Fit Jeans',
              },
              sizeLines: [
                { size: '30', plannedQty: 100 },
                { size: '32', plannedQty: 150 },
              ],
            },
          },
        },
      ]);

      const worklist = await repository.getWorklist(cuttingOperator.id);

      expect(prisma.stepInstance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            stepDefinition: {
              stationType: 'CUTTING',
            },
          }),
        }),
      );

      expect(worklist).toHaveLength(1);
      expect(worklist[0]).toMatchObject({
        id: 'step-cut-1',
        stepCode: 'CUTTING',
        stationType: 'CUTTING',
        status: 'READY',
        orderNumber: 'PO-20261018-001',
        totalPlannedQty: 250,
      });
    });
  });

  describe('startStep (BR-11, BR-16)', () => {
    it('BR-11: rejects Process Engineer attempting to start a PRODUCTION step', async () => {
      prisma.stepInstance.findUnique.mockResolvedValue({
        id: 'step-1',
        status: 'READY',
        stepDefinition: {
          code: 'CUTTING',
          stepType: 'PRODUCTION',
        },
        instance: { order: { id: 'ord-1' } },
      });

      await expect(repository.startStep('step-1', 'pe-user', 'PROCESS_ENGINEER')).rejects.toThrow(
        BusinessRuleViolation,
      );
    });

    it('rejects if step status is not READY or REWORK', async () => {
      prisma.stepInstance.findUnique.mockResolvedValue({
        id: 'step-1',
        status: 'PENDING',
        stepDefinition: {
          code: 'CUTTING',
          stepType: 'PRODUCTION',
        },
        instance: { order: { id: 'ord-1' } },
      });

      await expect(
        repository.startStep('step-1', cuttingOperator.id, cuttingOperator.role),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects if operator station does not match step station', async () => {
      prisma.stepInstance.findUnique.mockResolvedValue({
        id: 'step-1',
        status: 'READY',
        stepDefinition: {
          code: 'SEWING',
          stepType: 'PRODUCTION',
          stationType: 'SEWING',
        },
        instance: { order: { id: 'ord-1' } },
      });

      prisma.profile.findUnique.mockResolvedValue(cuttingOperator);

      await expect(
        repository.startStep('step-1', cuttingOperator.id, 'STATION_OPERATOR'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('successfully starts CUTTING, moves order to IN_PRODUCTION, and logs audit', async () => {
      prisma.stepInstance.findUnique.mockResolvedValue({
        id: 'step-cut-1',
        status: 'READY',
        stepDefinition: {
          code: 'CUTTING',
          stepType: 'PRODUCTION',
          stationType: 'CUTTING',
        },
        instance: {
          order: {
            id: 'ord-1',
            status: 'CONFIRMED',
          },
        },
      });

      prisma.profile.findUnique.mockResolvedValue(cuttingOperator);
      prisma.stepInstance.update.mockResolvedValue({
        id: 'step-cut-1',
        status: 'IN_PROGRESS',
      });

      const res = await repository.startStep('step-cut-1', cuttingOperator.id, 'STATION_OPERATOR');

      expect(res.status).toBe('IN_PROGRESS');
      expect(res.performedBy).toBe(cuttingOperator.id);

      // Verify order moved to IN_PRODUCTION
      expect(prisma.productionOrder.update).toHaveBeenCalledWith({
        where: { id: 'ord-1' },
        data: { status: 'IN_PRODUCTION' },
      });

      // Verify audit logs
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'START_PRODUCTION',
            entityType: 'ProductionOrder',
          }),
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'START_STEP',
            entityType: 'StepInstance',
          }),
        }),
      );
    });
  });

  describe('completeStep (BR-11, BR-15, BR-16)', () => {
    it('BR-11: rejects Process Engineer attempting to complete a PRODUCTION step', async () => {
      prisma.stepInstance.findUnique.mockResolvedValue({
        id: 'step-1',
        status: 'IN_PROGRESS',
        stepDefinition: {
          code: 'CUTTING',
          stepType: 'PRODUCTION',
        },
        instance: { order: { id: 'ord-1' } },
      });

      await expect(
        repository.completeStep('step-1', 'pe-user', 'PROCESS_ENGINEER'),
      ).rejects.toThrow(BusinessRuleViolation);
    });

    it('rejects if step is not IN_PROGRESS', async () => {
      prisma.stepInstance.findUnique.mockResolvedValue({
        id: 'step-1',
        status: 'READY',
        stepDefinition: {
          code: 'CUTTING',
          stepType: 'PRODUCTION',
        },
        instance: { order: { id: 'ord-1' } },
      });

      await expect(
        repository.completeStep('step-1', cuttingOperator.id, 'STATION_OPERATOR'),
      ).rejects.toThrow(ConflictException);
    });

    it('BR-15: rejects completion when step requires evidence and has 0 attachments', async () => {
      prisma.stepInstance.findUnique.mockResolvedValue({
        id: 'step-fin-1',
        status: 'IN_PROGRESS',
        stepDefinition: {
          code: 'FINISHING',
          stepType: 'PRODUCTION',
          requiresEvidence: true,
        },
        instance: { order: { id: 'ord-1' } },
      });

      prisma.evidence.count.mockResolvedValue(0);

      await expect(
        repository.completeStep('step-fin-1', cuttingOperator.id, 'STATION_OPERATOR'),
      ).rejects.toThrow(BusinessRuleViolation);
      expect(prisma.evidence.count).toHaveBeenCalledWith({
        where: { stepInstanceId: 'step-fin-1' },
      });
    });

    it('transitions step to WAITING_QC when requiresQc is true', async () => {
      prisma.stepInstance.findUnique.mockResolvedValue({
        id: 'step-sew-1',
        status: 'IN_PROGRESS',
        performedBy: cuttingOperator.id,
        stepDefinition: {
          code: 'SEWING',
          stepType: 'PRODUCTION',
          requiresEvidence: false,
          requiresQc: true,
        },
        instance: { order: { id: 'ord-1' } },
      });

      const res = await repository.completeStep(
        'step-sew-1',
        cuttingOperator.id,
        'STATION_OPERATOR',
      );

      expect(res.status).toBe('WAITING_QC');
      expect(prisma.stepInstance.update).toHaveBeenCalledWith({
        where: { id: 'step-sew-1' },
        data: expect.objectContaining({
          status: 'WAITING_QC',
        }),
      });
    });

    it('completes step to DONE and evaluates readiness opening successor step to READY', async () => {
      const stepCut = {
        id: 'step-cut-1',
        status: 'IN_PROGRESS',
        performedBy: cuttingOperator.id,
        stepDefinition: {
          id: 'def-cut',
          code: 'CUTTING',
          name: 'Cutting',
          seq: 10,
          stepType: 'PRODUCTION',
          isMandatory: true,
          requiresEvidence: false,
          requiresQc: false,
          conditionExpr: null,
        },
      };

      const stepSew = {
        id: 'step-sew-1',
        status: 'PENDING',
        stepDefinition: {
          id: 'def-sew',
          code: 'SEWING',
          name: 'Sewing',
          seq: 20,
          stepType: 'PRODUCTION',
          isMandatory: true,
          requiresEvidence: false,
          requiresQc: false,
          conditionExpr: null,
        },
      };

      prisma.stepInstance.findUnique.mockResolvedValue({
        ...stepCut,
        instance: {
          id: 'inst-1',
          order: {
            id: 'ord-1',
            status: 'IN_PRODUCTION',
            embroideryRequired: false,
            sizeLines: [{ size: '30', plannedQty: 100 }],
            washType: { code: 'RAW' },
            fabricType: { weightOz: 12 },
            bomLines: [
              {
                materialType: 'FABRIC',
                requiredQty: 150,
                materialAllocations: [{ allocatedQty: 150 }],
              },
            ],
          },
          stepInstances: [stepCut, stepSew],
        },
      });

      prisma.stepInstance.count.mockResolvedValue(1); // 1 step still pending

      const res = await repository.completeStep(
        'step-cut-1',
        cuttingOperator.id,
        'STATION_OPERATOR',
      );

      expect(res.status).toBe('DONE');
      expect(res.newlyReadyStepCodes).toContain('SEWING');

      // Verify SEWING was updated to READY in the DB
      expect(prisma.stepInstance.update).toHaveBeenCalledWith({
        where: { id: 'step-sew-1' },
        data: { status: 'READY' },
      });

      // Verify audit logs written
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'COMPLETE_STEP',
            entityType: 'StepInstance',
          }),
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'STEP_READY',
            entityType: 'StepInstance',
          }),
        }),
      );
    });
  });

  describe('recordQuantity (FR-13, BR-07, BR-08, BR-09, BR-11, BR-16)', () => {
    const mockStepSew = {
      id: 'step-sew-1',
      status: 'IN_PROGRESS',
      stepDefinition: {
        id: 'sd-sew',
        code: 'SEWING',
        name: 'Sewing',
        stepType: 'PRODUCTION',
        seq: 20,
        stationType: 'SEWING',
      },
      instance: {
        id: 'inst-1',
        order: {
          id: 'ord-1',
          orderNumber: 'PO-2026-001',
          sizeLines: [{ size: '30', plannedQty: 100 }],
        },
        stepInstances: [
          {
            id: 'step-cut-1',
            status: 'DONE',
            qtyGood: 100,
            stepDefinition: { id: 'sd-cut', code: 'CUTTING', seq: 10 },
          },
          {
            id: 'step-sew-1',
            status: 'IN_PROGRESS',
            stepDefinition: { id: 'sd-sew', code: 'SEWING', seq: 20 },
          },
        ],
      },
    };

    it('BR-11: rejects Process Engineer attempting to enter production quantities', async () => {
      prisma.stepInstance.findUnique.mockResolvedValue(mockStepSew);

      await expect(
        repository.recordQuantity(
          'step-sew-1',
          { size: '30', qtyGood: 50, qtyDefect: 0 },
          'user-pe-1',
          'PROCESS_ENGINEER',
        ),
      ).rejects.toThrow(BusinessRuleViolation);
    });

    it('BR-07: CUTTING rejects entry exceeding planned quantity + tolerance', async () => {
      const mockStepCut = {
        id: 'step-cut-1',
        status: 'IN_PROGRESS',
        stepDefinition: {
          id: 'sd-cut',
          code: 'CUTTING',
          name: 'Cutting',
          stepType: 'PRODUCTION',
          seq: 10,
          stationType: 'CUTTING',
        },
        instance: {
          id: 'inst-1',
          order: {
            id: 'ord-1',
            orderNumber: 'PO-2026-001',
            sizeLines: [{ size: '30', plannedQty: 100 }],
          },
          stepInstances: [
            {
              id: 'step-cut-1',
              status: 'IN_PROGRESS',
              stepDefinition: { id: 'sd-cut', code: 'CUTTING', seq: 10 },
            },
          ],
        },
      };

      prisma.stepInstance.findUnique.mockResolvedValue(mockStepCut);
      prisma.stepQuantityEntry.findMany.mockResolvedValue([]);

      // 100 plan + 5% tolerance = 105 max allowed. 106 must reject.
      await expect(
        repository.recordQuantity(
          'step-cut-1',
          { size: '30', qtyGood: 106, qtyDefect: 0 },
          cuttingOperator.id,
          'STATION_OPERATOR',
        ),
      ).rejects.toThrow(BusinessRuleViolation);
    });

    it('BR-08: rejects entry exceeding previous step good quantity', async () => {
      prisma.stepInstance.findUnique.mockResolvedValue(mockStepSew);
      prisma.stepQuantityEntry.findMany.mockResolvedValue([]);

      // Previous step has qtyGood = 100. Entry of 105 must reject.
      await expect(
        repository.recordQuantity(
          'step-sew-1',
          { size: '30', qtyGood: 105, qtyDefect: 0 },
          cuttingOperator.id,
          'STATION_OPERATOR',
        ),
      ).rejects.toThrow(BusinessRuleViolation);
    });

    it('BR-08 Concurrency test: two entries jointly exceeding previous good quantity are rejected on second entry', async () => {
      prisma.stepInstance.findUnique.mockResolvedValue(mockStepSew);
      // First transaction already recorded 60 pieces
      prisma.stepQuantityEntry.findMany.mockResolvedValue([
        { id: 'entry-1', size: '30', qtyGood: 60, qtyDefect: 0 },
      ]);

      // Previous good was 100. Attempting to record another 45 would total 105 > 100.
      await expect(
        repository.recordQuantity(
          'step-sew-1',
          { size: '30', qtyGood: 45, qtyDefect: 0 },
          cuttingOperator.id,
          'STATION_OPERATOR',
        ),
      ).rejects.toThrow(BusinessRuleViolation);
    });

    it('BR-09: outsourced step rejects quantity mismatch without reason and succeeds with reason', async () => {
      const mockStepWash = {
        id: 'step-wash-1',
        status: 'IN_PROGRESS',
        stepDefinition: {
          id: 'sd-wash',
          code: 'OUTSOURCED_WASH',
          name: 'Outsourced Wash',
          stepType: 'PRODUCTION',
          seq: 30,
          stationType: 'WASHING',
        },
        instance: {
          id: 'inst-1',
          order: {
            id: 'ord-1',
            orderNumber: 'PO-2026-001',
            sizeLines: [{ size: '30', plannedQty: 100 }],
          },
          stepInstances: [
            {
              id: 'step-sew-1',
              status: 'DONE',
              qtyGood: 100,
              stepDefinition: { id: 'sd-sew', code: 'SEWING', seq: 20 },
            },
            {
              id: 'step-wash-1',
              status: 'IN_PROGRESS',
              stepDefinition: {
                id: 'sd-wash',
                code: 'OUTSOURCED_WASH',
                seq: 30,
                stationType: 'WASH',
              },
            },
          ],
        },
      };

      prisma.stepInstance.findUnique.mockResolvedValue(mockStepWash);
      prisma.stepQuantityEntry.findMany.mockResolvedValue([]);

      // Mismatch: sent 100, received 95, no reason -> Throws BR-09
      await expect(
        repository.recordQuantity(
          'step-wash-1',
          { size: '30', qtyGood: 95, qtyDefect: 0, qtySent: 100, qtyReceived: 95 },
          cuttingOperator.id,
          'STATION_OPERATOR',
        ),
      ).rejects.toThrow(BusinessRuleViolation);

      // Mismatch with reason -> Succeeds
      prisma.stepQuantityEntry.create.mockResolvedValue({
        id: 'entry-wash-1',
        stepInstanceId: 'step-wash-1',
        size: '30',
        qtyGood: 95,
        qtyDefect: 0,
        qtySent: 100,
        qtyReceived: 95,
        mismatchReason: '5 units damaged during transport',
        note: null,
        enteredBy: cuttingOperator.id,
        enteredAt: new Date(),
      });

      const res = await repository.recordQuantity(
        'step-wash-1',
        {
          size: '30',
          qtyGood: 95,
          qtyDefect: 0,
          qtySent: 100,
          qtyReceived: 95,
          mismatchReason: '5 units damaged during transport',
        },
        cuttingOperator.id,
        'STATION_OPERATOR',
      );

      expect(res.qtyGood).toBe(95);
      expect(res.mismatchReason).toBe('5 units damaged during transport');
    });

    it('executes pessimistic lock and records audit log on successful quantity entry', async () => {
      prisma.stepInstance.findUnique.mockResolvedValue(mockStepSew);
      prisma.stepQuantityEntry.findMany.mockResolvedValue([]);
      prisma.stepQuantityEntry.create.mockResolvedValue({
        id: 'entry-valid-1',
        stepInstanceId: 'step-sew-1',
        size: '30',
        qtyGood: 50,
        qtyDefect: 2,
        qtySent: null,
        qtyReceived: null,
        mismatchReason: null,
        note: null,
        enteredBy: cuttingOperator.id,
        enteredAt: new Date(),
      });

      const res = await repository.recordQuantity(
        'step-sew-1',
        { size: '30', qtyGood: 50, qtyDefect: 2 },
        cuttingOperator.id,
        'STATION_OPERATOR',
      );

      // Verify pessimistic lock query executed
      expect(prisma.$executeRaw).toHaveBeenCalled();

      // Verify step instance aggregates updated
      expect(prisma.stepInstance.update).toHaveBeenCalledWith({
        where: { id: 'step-sew-1' },
        data: {
          qtyIn: 100,
          qtyGood: 50,
          qtyDefect: 2,
        },
      });

      // Verify AuditLog written
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'RECORD_QUANTITY',
            entityType: 'StepQuantityEntry',
          }),
        }),
      );

      expect(res.qtyGood).toBe(50);
      expect(res.qtyDefect).toBe(2);
    });
  });

  describe('generateBundles (FR-15)', () => {
    it('generates standard bundles with bundle code PO-...-B001', async () => {
      const mockStepCut = {
        id: 'step-cut-1',
        stepDefinition: { code: 'CUTTING' },
        instance: {
          order: {
            id: 'ord-1',
            orderNumber: 'PO-2026-001',
            sizeLines: [{ size: '30', plannedQty: 100 }],
            bundles: [],
          },
        },
      };

      prisma.stepInstance.findUnique.mockResolvedValue(mockStepCut);
      prisma.bundle.create.mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'bundle-' + data.bundleCode,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        }),
      );

      const bundles = await repository.generateBundles('step-cut-1', cuttingOperator.id);

      expect(bundles).toHaveLength(2); // 100 units / 50 per bundle = 2 bundles
      expect(bundles[0]!.bundleCode).toBe('PO-2026-001-B001');
      expect(bundles[0]!.qty).toBe(50);
      expect(bundles[1]!.bundleCode).toBe('PO-2026-001-B002');
      expect(bundles[1]!.qty).toBe(50);
    });
  });
});
