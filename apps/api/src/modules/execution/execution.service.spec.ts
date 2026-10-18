import { ConflictException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessRuleViolation } from '../../common/errors/business-rule-violation.js';
import type { ExecutionRepository } from './execution.repository.js';
import { ExecutionService } from './execution.service.js';
import type { QuantityService } from './quantity.service.js';

type User = { id: string; email: string; fullName: string; role: string; isActive: boolean };

const user = (role: string, id = `user-${role.toLowerCase()}`): User => ({
  id,
  email: `${role.toLowerCase()}@denimflow.test`,
  fullName: role,
  role,
  isActive: true,
});

const order = (overrides: Record<string, unknown> = {}) => ({
  id: 'order-1',
  status: 'CONFIRMED',
  dyeRequired: false,
  dyeMode: null,
  dyeSource: null,
  embroideryRequired: false,
  fabricInspectRequired: false,
  ppSampleRequired: false,
  skipCleanWash: false,
  washTypeId: null,
  isCustom: false,
  bomLines: [],
  ...overrides,
});

const definition = (code: string, overrides: Record<string, unknown> = {}) => ({
  code,
  name: code,
  stepType: 'PRODUCTION',
  seq: 1,
  responsibleRole: 'STATION_OPERATOR',
  stationType: code === 'CUTTING' ? 'CUTTING' : 'SEWING',
  isMandatory: true,
  requiresEvidence: false,
  requiresQc: false,
  conditionExpr: null,
  ...overrides,
});

const stepForTransition = (
  code: string,
  status: string,
  defOverrides: Record<string, unknown> = {},
  orderOverrides: Record<string, unknown> = {},
) => ({
  id: `step-${code}`,
  instanceId: 'instance-1',
  status,
  stepDefinition: definition(code, defOverrides),
  instance: { order: order(orderOverrides) },
});

const createRepo = () => ({
  runInTransaction: vi.fn((work: (tx: unknown) => unknown) => work({})),
  findProfileWithStation: vi.fn(),
  findWorklistSteps: vi.fn().mockResolvedValue([]),
  findStepForTransition: vi.fn(),
  findInstanceForReadiness: vi.fn(),
  transitionStep: vi.fn().mockResolvedValue(1),
  markOrderInProduction: vi.fn().mockResolvedValue(1),
  recordAudit: vi.fn().mockResolvedValue(undefined),
});

describe('ExecutionService', () => {
  let repo: ReturnType<typeof createRepo>;
  let quantities: { closeOnComplete: ReturnType<typeof vi.fn> };
  let service: ExecutionService;

  beforeEach(() => {
    repo = createRepo();
    quantities = { closeOnComplete: vi.fn().mockResolvedValue(undefined) };
    service = new ExecutionService(
      repo as unknown as ExecutionRepository,
      quantities as unknown as QuantityService,
    );
  });

  const operatorAt = (stationType: string | null) =>
    repo.findProfileWithStation.mockResolvedValue({
      id: 'user-station_operator',
      role: 'STATION_OPERATOR',
      station: stationType ? { stationType } : null,
    });

  describe('getWorklist (FR-12)', () => {
    it('FR-12: an operator without a station sees nothing', async () => {
      operatorAt(null);
      await expect(service.getWorklist(user('STATION_OPERATOR'))).resolves.toEqual([]);
      expect(repo.findWorklistSteps).not.toHaveBeenCalled();
    });

    it("FR-12: an operator only sees steps of their station's type", async () => {
      operatorAt('CUTTING');
      await service.getWorklist(user('STATION_OPERATOR'), { stationType: 'SEWING' });
      expect(repo.findWorklistSteps).toHaveBeenCalledWith({
        status: { in: ['READY', 'IN_PROGRESS', 'REWORK'] },
        stepDefinition: { stationType: 'CUTTING' },
      });
    });

    it('a QC inspector sees QC steps, including those waiting for QC', async () => {
      repo.findProfileWithStation.mockResolvedValue({
        id: 'u',
        role: 'QC_INSPECTOR',
        station: null,
      });
      await service.getWorklist(user('QC_INSPECTOR'));
      expect(repo.findWorklistSteps).toHaveBeenCalledWith({
        status: { in: ['READY', 'IN_PROGRESS', 'REWORK', 'WAITING_QC'] },
        stepDefinition: { stepType: 'QC' },
      });
    });
  });

  describe('startStep', () => {
    it('BR-11: the Process Engineer cannot start a production step', async () => {
      repo.findStepForTransition.mockResolvedValue(stepForTransition('SEWING', 'READY'));
      await expect(service.startStep('step-SEWING', user('PROCESS_ENGINEER'))).rejects.toThrow(
        BusinessRuleViolation,
      );
    });

    it("rejects a user whose role is not the step's responsible role", async () => {
      repo.findStepForTransition.mockResolvedValue(stepForTransition('SEWING', 'READY'));
      await expect(service.startStep('step-SEWING', user('MANAGER'))).rejects.toThrow(
        ForbiddenException,
      );
      expect(repo.transitionStep).not.toHaveBeenCalled();
    });

    it('rejects an operator from another station type', async () => {
      repo.findStepForTransition.mockResolvedValue(stepForTransition('SEWING', 'READY'));
      operatorAt('CUTTING');
      await expect(service.startStep('step-SEWING', user('STATION_OPERATOR'))).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects a step that is not READY or REWORK', async () => {
      repo.findStepForTransition.mockResolvedValue(stepForTransition('SEWING', 'PENDING'));
      operatorAt('SEWING');
      await expect(service.startStep('step-SEWING', user('STATION_OPERATOR'))).rejects.toThrow(
        ConflictException,
      );
    });

    it('rejects when another request changed the step first (compare-and-set lost)', async () => {
      repo.findStepForTransition.mockResolvedValue(stepForTransition('SEWING', 'READY'));
      operatorAt('SEWING');
      repo.transitionStep.mockResolvedValue(0);
      await expect(service.startStep('step-SEWING', user('STATION_OPERATOR'))).rejects.toThrow(
        ConflictException,
      );
      expect(repo.recordAudit).not.toHaveBeenCalled();
    });

    it('starting cutting moves a CONFIRMED order to IN_PRODUCTION and audits both (BR-16)', async () => {
      repo.findStepForTransition.mockResolvedValue(stepForTransition('CUTTING', 'READY'));
      operatorAt('CUTTING');

      const result = await service.startStep('step-CUTTING', user('STATION_OPERATOR'));

      expect(result.status).toBe('IN_PROGRESS');
      expect(repo.transitionStep).toHaveBeenCalledWith({}, 'step-CUTTING', ['READY', 'REWORK'], {
        status: 'IN_PROGRESS',
        startedAt: expect.any(Date),
        performedBy: 'user-station_operator',
      });
      expect(repo.markOrderInProduction).toHaveBeenCalledWith({}, 'order-1');
      expect(repo.recordAudit.mock.calls.map((c) => c[1].action)).toEqual([
        'START_STEP',
        'START_PRODUCTION',
      ]);
    });

    it('detects cutting by station type, not by step code', async () => {
      repo.findStepForTransition.mockResolvedValue(
        stepForTransition('CUT', 'READY', { stationType: 'CUTTING' }),
      );
      operatorAt('CUTTING');
      await service.startStep('step-CUT', user('STATION_OPERATOR'));
      expect(repo.markOrderInProduction).toHaveBeenCalled();
    });
  });

  describe('completeStep', () => {
    it('a step that requires QC goes to WAITING_QC and opens nothing', async () => {
      repo.findStepForTransition.mockResolvedValue(
        stepForTransition('SEWING', 'IN_PROGRESS', { requiresQc: true }),
      );
      operatorAt('SEWING');

      const result = await service.completeStep('step-SEWING', user('STATION_OPERATOR'));

      expect(result).toMatchObject({ status: 'WAITING_QC', newlyReadyStepCodes: [] });
      expect(repo.findInstanceForReadiness).not.toHaveBeenCalled();
      // R-23: the completer is recorded for the BR-11 check at QC.
      expect(repo.transitionStep).toHaveBeenCalledWith(
        {},
        'step-SEWING',
        ['IN_PROGRESS'],
        expect.objectContaining({ status: 'WAITING_QC', completedBy: 'user-station_operator' }),
      );
    });

    it('closes the quantities (BR-08 balance, bundles) before changing the status', async () => {
      repo.findStepForTransition.mockResolvedValue(stepForTransition('SEWING', 'IN_PROGRESS'));
      operatorAt('SEWING');
      repo.findInstanceForReadiness.mockResolvedValue({
        id: 'instance-1',
        order: order(),
        stepInstances: [],
      });
      quantities.closeOnComplete.mockRejectedValue(
        new BusinessRuleViolation('BR-08', 'BR-08: thiếu'),
      );

      await expect(service.completeStep('step-SEWING', user('STATION_OPERATOR'))).rejects.toThrow(
        BusinessRuleViolation,
      );
      expect(quantities.closeOnComplete).toHaveBeenCalledWith(
        {},
        'step-SEWING',
        'user-station_operator',
      );
      expect(repo.transitionStep).not.toHaveBeenCalled();
    });

    it('rejects a step that is not IN_PROGRESS', async () => {
      repo.findStepForTransition.mockResolvedValue(stepForTransition('SEWING', 'READY'));
      operatorAt('SEWING');
      await expect(service.completeStep('step-SEWING', user('STATION_OPERATOR'))).rejects.toThrow(
        ConflictException,
      );
    });

    const instance = (orderOverrides: Record<string, unknown>) => ({
      id: 'instance-1',
      order: order({ status: 'IN_PRODUCTION', ...orderOverrides }),
      stepInstances: [
        { id: 'step-SEWING', status: 'DONE', stepDefinition: definition('SEWING', { seq: 8 }) },
        {
          id: 'step-DYEING',
          status: 'PENDING',
          stepDefinition: definition('DYEING', {
            seq: 9,
            conditionExpr: { op: 'eq', field: 'order.dyeRequired', value: true },
          }),
        },
        {
          id: 'step-CLEAN_WASH',
          status: 'PENDING',
          stepDefinition: definition('CLEAN_WASH', {
            seq: 10,
            conditionExpr: {
              op: 'not',
              arg: { op: 'eq', field: 'order.skipCleanWash', value: true },
            },
          }),
        },
      ],
    });

    it('opens DYEING for an order that requires dyeing (same order.* context as Confirm)', async () => {
      repo.findStepForTransition.mockResolvedValue(stepForTransition('SEWING', 'IN_PROGRESS'));
      operatorAt('SEWING');
      repo.findInstanceForReadiness.mockResolvedValue(instance({ dyeRequired: true }));

      const result = await service.completeStep('step-SEWING', user('STATION_OPERATOR'));

      expect(result.status).toBe('DONE');
      expect(result.newlyReadyStepCodes).toEqual(['DYEING']);
      expect(result.newlySkippedStepCodes).toEqual([]);
    });

    it('skips DYEING and opens CLEAN_WASH when no dyeing is required', async () => {
      repo.findStepForTransition.mockResolvedValue(stepForTransition('SEWING', 'IN_PROGRESS'));
      operatorAt('SEWING');
      repo.findInstanceForReadiness.mockResolvedValue(instance({ dyeRequired: false }));

      const result = await service.completeStep('step-SEWING', user('STATION_OPERATOR'));

      expect(result.newlySkippedStepCodes).toEqual(['DYEING']);
      expect(result.newlyReadyStepCodes).toEqual(['CLEAN_WASH']);
    });

    it('never marks the order COMPLETED (handover in S5 closes it)', async () => {
      repo.findStepForTransition.mockResolvedValue(stepForTransition('SEWING', 'IN_PROGRESS'));
      operatorAt('SEWING');
      repo.findInstanceForReadiness.mockResolvedValue(instance({}));

      await service.completeStep('step-SEWING', user('STATION_OPERATOR'));

      const actions = repo.recordAudit.mock.calls.map((c) => c[1].action);
      expect(actions).not.toContain('ORDER_COMPLETED');
      expect(repo.markOrderInProduction).not.toHaveBeenCalled();
    });
  });
});
