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
});
