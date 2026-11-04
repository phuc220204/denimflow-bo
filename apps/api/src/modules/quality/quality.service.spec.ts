import { ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessRuleViolation } from '../../common/errors/business-rule-violation.js';
import type { ExecutionRepository } from '../execution/execution.repository.js';
import type { ExecutionService } from '../execution/execution.service.js';
import type { QualityRepository } from './quality.repository.js';
import { QualityService } from './quality.service.js';

const inspector = {
  id: 'user-qc',
  email: 'qc@denimflow.test',
  fullName: 'QC',
  role: 'QC_INSPECTOR',
  isActive: true,
};

const step = (status: string, stepType = 'PRODUCTION', code = 'SEWING') => ({
  id: `step-${code}`,
  instanceId: 'instance-1',
  status,
  stepDefinition: {
    code,
    stepType,
    responsibleRole: stepType === 'QC' ? 'QC_INSPECTOR' : 'STATION_OPERATOR',
    stationType: stepType === 'QC' ? 'QC' : 'SEWING',
  },
  instance: {
    order: {
      id: 'order-1',
      qcProfile: {
        id: 'profile-full',
        profileType: 'FULL_PROCESS',
        maxShrinkagePercent: 3,
        maxColorFadingLevel: 1,
      },
    },
  },
});

const pass = { sampleSize: 20, defects: [], result: 'PASS' as const };

describe('QualityService', () => {
  let quality: Record<string, ReturnType<typeof vi.fn>>;
  let execution: Record<string, ReturnType<typeof vi.fn>>;
  let executionService: { openNextSteps: ReturnType<typeof vi.fn> };
  let service: QualityService;

  const lockedStatus = (status: string) =>
    execution.findStepsByIds!.mockResolvedValue([{ id: 'x', status }]);

  beforeEach(() => {
    quality = {
      findStepForInspection: vi.fn().mockResolvedValue(step('WAITING_QC')),
      findBundleOrders: vi.fn().mockResolvedValue([]),
      createInspection: vi.fn((_tx: unknown, data: Record<string, unknown>) =>
        Promise.resolve({
          ...data,
          id: 'inspection-1',
          measuredShrinkagePercent: data.measuredShrinkagePercent ?? null,
          createdAt: new Date('2026-10-19T09:00:00Z'),
          defects: [],
        }),
      ),
      findInspections: vi.fn().mockResolvedValue([]),
    };
    execution = {
      runInTransaction: vi.fn((work: (tx: unknown) => unknown) => work({})),
      lockSteps: vi.fn().mockResolvedValue(undefined),
      findStepsByIds: vi.fn().mockResolvedValue([{ id: 'step-SEWING', status: 'WAITING_QC' }]),
      findStepPerformers: vi.fn().mockResolvedValue({
        performedBy: 'user-op',
        completedBy: 'user-op',
        quantityEnteredBy: ['user-op'],
      }),
      findProfileWithStation: vi.fn(),
      transitionStep: vi.fn().mockResolvedValue(1),
      recordAudit: vi.fn().mockResolvedValue(undefined),
    };
    executionService = {
      openNextSteps: vi
        .fn()
        .mockResolvedValue({ newlyReadyStepCodes: ['CLEAN_WASH'], newlySkippedStepCodes: [] }),
    };
    service = new QualityService(
      quality as unknown as QualityRepository,
      execution as unknown as ExecutionRepository,
      executionService as unknown as ExecutionService,
    );
  });

  it('does not record REWORK or REJECT before T5.2', async () => {
    await expect(
      service.recordInspection('step-SEWING', { ...pass, result: 'REWORK' }, inspector),
    ).rejects.toThrow(ConflictException);
    expect(execution.runInTransaction).not.toHaveBeenCalled();
  });

  it('re-reads the status after locking and refuses a step that is not waiting for QC', async () => {
    lockedStatus('DONE');
    await expect(service.recordInspection('step-SEWING', pass, inspector)).rejects.toThrow(
      /chưa thể kiểm tra QC/,
    );
    expect(execution.lockSteps).toHaveBeenCalledWith({}, ['step-SEWING']);
  });

  it('BR-11 refuses an inspector who worked the inspected step', async () => {
    execution.findStepPerformers!.mockResolvedValue({
      performedBy: 'user-op',
      completedBy: 'user-op',
      quantityEnteredBy: ['user-qc'],
    });
    await expect(service.recordInspection('step-SEWING', pass, inspector)).rejects.toThrow(/BR-11/);
    expect(quality.createInspection).not.toHaveBeenCalled();
  });

  it('BR-19 refuses a PASS when a measured value exceeds the order profile', async () => {
    await expect(
      service.recordInspection('step-SEWING', { ...pass, measuredShrinkagePercent: 4 }, inspector),
    ).rejects.toThrow(BusinessRuleViolation);
    expect(execution.transitionStep).not.toHaveBeenCalled();
  });

  it('a PASS records the proposal and profile, completes the step and opens the next ones', async () => {
    const result = await service.recordInspection(
      'step-SEWING',
      { ...pass, measuredShrinkagePercent: 2 },
      inspector,
    );

    expect(quality.createInspection).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        qcProfileId: 'profile-full',
        proposedResult: 'PASS',
        result: 'PASS',
        inspectorId: 'user-qc',
      }),
    );
    expect(execution.transitionStep).toHaveBeenCalledWith({}, 'step-SEWING', ['WAITING_QC'], {
      status: 'DONE',
      completedAt: expect.any(Date),
    });
    expect(executionService.openNextSteps).toHaveBeenCalledWith({}, 'instance-1', 'user-qc');
    expect(execution.recordAudit!.mock.calls.map((c) => c[1].action)).toEqual([
      'QC_INSPECTION',
      'QC_PASS',
    ]);
    expect(result).toMatchObject({ stepStatus: 'DONE', newlyReadyStepCodes: ['CLEAN_WASH'] });
  });

  it('a QC-type step is checked like any step the inspector works and records the completer', async () => {
    quality.findStepForInspection!.mockResolvedValue(step('IN_PROGRESS', 'QC', 'FINAL_QC'));
    lockedStatus('IN_PROGRESS');

    await service.recordInspection('step-FINAL_QC', pass, inspector);

    expect(execution.findStepPerformers).not.toHaveBeenCalled();
    expect(execution.transitionStep).toHaveBeenCalledWith(
      {},
      'step-FINAL_QC',
      ['IN_PROGRESS'],
      expect.objectContaining({ status: 'DONE', completedBy: 'user-qc' }),
    );
  });

  it('rejects defects on bundles of another order', async () => {
    quality.findBundleOrders!.mockResolvedValue([{ id: 'b1', orderId: 'order-2' }]);
    await expect(
      service.recordInspection(
        'step-SEWING',
        { ...pass, defects: [{ defectType: 'Lỗi', qty: 1, bundleId: 'b1' }] },
        inspector,
      ),
    ).rejects.toThrow(/không thuộc đơn hàng/);
  });
});
