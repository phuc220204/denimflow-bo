import { ConflictException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { QualityRepository } from './quality.repository.js';

describe('QualityRepository (T5.1, FR-16, BR-11, BR-19)', () => {
  let repository: QualityRepository;
  let prisma: {
    $transaction: ReturnType<typeof vi.fn>;
    $executeRaw: ReturnType<typeof vi.fn>;
    stepInstance: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
    qcInspection: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
    defect: {
      create: ReturnType<typeof vi.fn>;
    };
    auditLog: {
      create: ReturnType<typeof vi.fn>;
    };
    workflowInstance: {
      update: ReturnType<typeof vi.fn>;
    };
    productionOrder: {
      update: ReturnType<typeof vi.fn>;
    };
  };

  const mockStepWaitingQc = {
    id: 'step-qc-1',
    status: 'WAITING_QC',
    performedBy: 'operator-1',
    stepDefinition: {
      id: 'sd-sew',
      code: 'SEWING',
      name: 'May ráp',
      seq: 20,
      isMandatory: true,
      requiresEvidence: false,
      requiresQc: true,
      responsibleRole: 'STATION_OPERATOR',
      toTransitions: [],
    },
    instance: {
      id: 'inst-1',
      order: {
        id: 'ord-1',
        status: 'IN_PRODUCTION',
        skipCleanWash: false,
        sizeLines: [{ size: '30', plannedQty: 100 }],
        bomLines: [],
        style: {
          id: 'style-1',
          qcProfiles: [
            {
              id: 'prof-full',
              profileType: 'FULL_PROCESS',
              maxShrinkagePercent: '3.0',
              maxColorFadingLevel: 2,
            },
            {
              id: 'prof-skip',
              profileType: 'SKIP_CLEAN_WASH',
              maxShrinkagePercent: '5.5',
              maxColorFadingLevel: 4,
            },
          ],
        },
      },
      stepInstances: [],
    },
  };

  beforeEach(() => {
    prisma = {
      $transaction: vi.fn(async (cb: (tx: typeof prisma) => unknown) => cb(prisma)),
      $executeRaw: vi.fn().mockResolvedValue(1),
      stepInstance: {
        findUnique: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      qcInspection: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
      defect: {
        create: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      workflowInstance: {
        update: vi.fn(),
      },
      productionOrder: {
        update: vi.fn().mockResolvedValue({}),
      },
    };

    repository = new QualityRepository(prisma as unknown as PrismaService);
  });

  describe('evaluateInspection (Strategy, BR-19)', () => {
    it('evaluates proposed recommendation using the order style QC profile', async () => {
      prisma.stepInstance.findUnique.mockResolvedValue(mockStepWaitingQc);

      const res = await repository.evaluateInspection('step-qc-1', {
        sampleSize: 100,
        measuredShrinkagePercent: 2.5,
        measuredColorFadingLevel: 1,
      });

      expect(res.passed).toBe(true);
      expect(res.proposedResult).toBe('PASS');
    });
  });

  describe('recordInspection (BR-11, BR-16, BR-19)', () => {
    it('BR-11: rejects QC inspection when inspector is the same person who performed the step', async () => {
      prisma.stepInstance.findUnique.mockResolvedValue(mockStepWaitingQc);

      await expect(
        repository.recordInspection(
          {
            stepInstanceId: 'step-qc-1',
            sampleSize: 50,
            result: 'PASS',
          },
          'operator-1', // same as step.performedBy
          'QC_INSPECTOR',
        ),
      ).rejects.toThrow('BR-11: Performer may not approve QC for their own step');
    });

    it('rejects when step is not WAITING_QC', async () => {
      prisma.stepInstance.findUnique.mockResolvedValue({
        ...mockStepWaitingQc,
        status: 'IN_PROGRESS',
      });

      await expect(
        repository.recordInspection(
          {
            stepInstanceId: 'step-qc-1',
            sampleSize: 50,
            result: 'PASS',
          },
          'qc-inspector-2',
          'QC_INSPECTOR',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects when actor does not have QC_INSPECTOR or ADMIN role', async () => {
      prisma.stepInstance.findUnique.mockResolvedValue(mockStepWaitingQc);

      await expect(
        repository.recordInspection(
          {
            stepInstanceId: 'step-qc-1',
            sampleSize: 50,
            result: 'PASS',
          },
          'qc-inspector-2',
          'STATION_OPERATOR',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('records inspection with PASS, transitions step to DONE and writes AuditLog', async () => {
      prisma.stepInstance.findUnique.mockResolvedValue(mockStepWaitingQc);
      prisma.qcInspection.create.mockResolvedValue({
        id: 'qc-insp-1',
        stepInstanceId: 'step-qc-1',
        inspectorId: 'qc-inspector-2',
        qcProfileId: 'prof-full',
        sampleSize: 50,
        measuredShrinkagePercent: '2.5',
        measuredColorFadingLevel: 1,
        result: 'PASS',
        reworkTargetStepId: null,
        reason: null,
        notes: 'Passed all checks',
        createdAt: new Date(),
      });
      prisma.stepInstance.count.mockResolvedValue(1);

      const res = await repository.recordInspection(
        {
          stepInstanceId: 'step-qc-1',
          sampleSize: 50,
          measuredShrinkagePercent: 2.5,
          measuredColorFadingLevel: 1,
          result: 'PASS',
          notes: 'Passed all checks',
        },
        'qc-inspector-2',
        'QC_INSPECTOR',
      );

      // Verify row lock
      expect(prisma.$executeRaw).toHaveBeenCalled();

      // Verify step marked DONE
      expect(prisma.stepInstance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'step-qc-1' },
          data: expect.objectContaining({
            status: 'DONE',
          }),
        }),
      );

      // Verify AuditLog written
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'RECORD_QC_INSPECTION',
            entityType: 'QcInspection',
            actorId: 'qc-inspector-2',
          }),
        }),
      );

      expect(res.id).toBe('qc-insp-1');
      expect(res.result).toBe('PASS');
    });

    it('records inspection with REWORK, transitions step to REWORK and increments reworkCount', async () => {
      prisma.stepInstance.findUnique.mockResolvedValue(mockStepWaitingQc);
      prisma.qcInspection.create.mockResolvedValue({
        id: 'qc-insp-2',
        stepInstanceId: 'step-qc-1',
        inspectorId: 'qc-inspector-2',
        qcProfileId: 'prof-full',
        sampleSize: 50,
        measuredShrinkagePercent: '4.8',
        measuredColorFadingLevel: 3,
        result: 'REWORK',
        reworkTargetStepId: 'step-qc-1',
        reason: 'Shrinkage too high',
        notes: null,
        createdAt: new Date(),
      });

      const res = await repository.recordInspection(
        {
          stepInstanceId: 'step-qc-1',
          sampleSize: 50,
          measuredShrinkagePercent: 4.8,
          measuredColorFadingLevel: 3,
          result: 'REWORK',
          reworkTargetStepId: 'step-qc-1',
          reason: 'Shrinkage too high',
        },
        'qc-inspector-2',
        'QC_INSPECTOR',
      );

      expect(prisma.stepInstance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'step-qc-1' },
          data: expect.objectContaining({
            status: 'REWORK',
            reworkCount: { increment: 1 },
          }),
        }),
      );

      expect(res.result).toBe('REWORK');
    });

    it('BR-10: rejects REWORK when reason is missing', async () => {
      prisma.stepInstance.findUnique.mockResolvedValue({
        id: 'step-qc-1',
        status: 'WAITING_QC',
        performedBy: 'operator-1',
        stepDefinition: {
          id: 'sdef-qc',
          code: 'FINAL_QC',
          name: 'Final QC',
          seq: 13,
          maxRework: 2,
        },
        instance: {
          id: 'inst-1',
          order: { id: 'order-1', skipCleanWash: false, style: { qcProfiles: [] } },
          stepInstances: [],
        },
      });

      await expect(
        repository.recordInspection(
          {
            stepInstanceId: 'step-qc-1',
            sampleSize: 50,
            result: 'REWORK',
            reworkTargetStepId: 'step-qc-1',
            reason: '',
          },
          'qc-inspector-2',
          'QC_INSPECTOR',
        ),
      ).rejects.toThrow('BR-10: Lý do làm lại/từ chối là bắt buộc');
    });

    it('BR-10: rejects REWORK when reworkTargetStepId is missing', async () => {
      prisma.stepInstance.findUnique.mockResolvedValue({
        id: 'step-qc-1',
        status: 'WAITING_QC',
        performedBy: 'operator-1',
        stepDefinition: {
          id: 'sdef-qc',
          code: 'FINAL_QC',
          name: 'Final QC',
          seq: 13,
          maxRework: 2,
        },
        instance: {
          id: 'inst-1',
          order: { id: 'order-1', skipCleanWash: false, style: { qcProfiles: [] } },
          stepInstances: [],
        },
      });

      await expect(
        repository.recordInspection(
          {
            stepInstanceId: 'step-qc-1',
            sampleSize: 50,
            result: 'REWORK',
            reason: 'Lỗi đường chỉ',
          },
          'qc-inspector-2',
          'QC_INSPECTOR',
        ),
      ).rejects.toThrow('BR-10: Bắt buộc phải chọn công đoạn để làm lại');
    });

    it('BR-10: rejects REWORK and flags order for Planner exception when reworkCount reaches maxRework', async () => {
      prisma.stepInstance.findUnique.mockResolvedValue({
        id: 'step-qc-1',
        status: 'WAITING_QC',
        performedBy: 'operator-1',
        stepDefinition: {
          id: 'sdef-qc',
          code: 'FINAL_QC',
          name: 'Final QC',
          seq: 13,
          maxRework: 2,
        },
        instance: {
          id: 'inst-1',
          order: {
            id: 'order-1',
            skipCleanWash: false,
            notes: 'Ghi chú ban đầu',
            style: { qcProfiles: [] },
          },
          stepInstances: [
            {
              id: 'step-sew-8',
              status: 'DONE',
              reworkCount: 2, // already at maxRework 2
              stepDefinition: {
                id: 'sdef-sew',
                code: 'SEWING',
                name: 'May ráp',
                seq: 8,
                maxRework: 2,
              },
            },
          ],
        },
      });

      await expect(
        repository.recordInspection(
          {
            stepInstanceId: 'step-qc-1',
            sampleSize: 50,
            result: 'REWORK',
            reworkTargetStepId: 'step-sew-8',
            reason: 'Đường may vẫn lệch sau 2 lần sửa',
          },
          'qc-inspector-2',
          'QC_INSPECTOR',
        ),
      ).rejects.toThrow('BR-10: Vượt quá giới hạn làm lại tối đa');

      // Verify order was flagged in notes
      expect(prisma.productionOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-1' },
          data: expect.objectContaining({
            notes: expect.stringContaining('FLAGGED_FOR_PLANNER_EXCEPTION'),
          }),
        }),
      );

      // Verify AuditLog written for exception
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entityType: 'ProductionOrder',
            entityId: 'order-1',
            action: 'ORDER_FLAGGED_FOR_PLANNER_EXCEPTION',
          }),
        }),
      );
    });
  });

  describe('getInspections', () => {
    it('returns list of inspections with defects', async () => {
      prisma.qcInspection.findMany.mockResolvedValue([
        {
          id: 'qc-insp-1',
          stepInstanceId: 'step-qc-1',
          inspectorId: 'qc-inspector-2',
          qcProfileId: 'prof-full',
          sampleSize: 50,
          measuredShrinkagePercent: '2.5',
          measuredColorFadingLevel: 1,
          result: 'PASS',
          reworkTargetStepId: null,
          reason: null,
          notes: null,
          createdAt: new Date(),
          defects: [
            {
              id: 'def-1',
              inspectionId: 'qc-insp-1',
              bundleId: null,
              defectType: 'LOOSE_THREAD',
              qty: 1,
              createdAt: new Date(),
            },
          ],
        },
      ]);

      const list = await repository.getInspections('step-qc-1');
      expect(list).toHaveLength(1);
      expect(list[0]!.defects).toHaveLength(1);
      expect(list[0]!.defects[0]!.defectType).toBe('LOOSE_THREAD');
    });
  });

  describe('getReworkTargets', () => {
    it('returns predecessor and current steps as valid rework targets', async () => {
      prisma.stepInstance.findUnique.mockResolvedValue({
        id: 'step-qc-13',
        status: 'WAITING_QC',
        stepDefinition: { id: 'sd-qc', code: 'FINAL_QC', name: 'Final QC', seq: 13, maxRework: 2 },
        instance: {
          stepInstances: [
            {
              id: 'step-sew-8',
              status: 'DONE',
              reworkCount: 1,
              stepDefinition: {
                id: 'sd-sew',
                code: 'SEWING',
                name: 'May ráp',
                seq: 8,
                maxRework: 2,
              },
            },
            {
              id: 'step-qc-13',
              status: 'WAITING_QC',
              reworkCount: 0,
              stepDefinition: {
                id: 'sd-qc',
                code: 'FINAL_QC',
                name: 'Final QC',
                seq: 13,
                maxRework: 2,
              },
            },
            {
              id: 'step-pack-14',
              status: 'PENDING',
              reworkCount: 0,
              stepDefinition: {
                id: 'sd-pack',
                code: 'PACK_HANDOVER',
                name: 'Bàn giao',
                seq: 14,
                maxRework: 2,
              },
            },
          ],
        },
      });

      const targets = await repository.getReworkTargets('step-qc-13');
      expect(targets).toHaveLength(2); // Only seq <= 13 (SEWING and FINAL_QC, not PACK_HANDOVER)
      expect(targets[0]!.code).toBe('SEWING');
      expect(targets[0]!.reworkCount).toBe(1);
      expect(targets[1]!.code).toBe('FINAL_QC');
    });
  });
});
