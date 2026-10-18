import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  evaluateStepReadiness,
  type StepInstanceSnapshot,
  type WorkflowInstanceSnapshot,
} from '@denimflow/engine';
import {
  type CompleteStepResponseDto,
  type StartStepResponseDto,
  type StepStatus,
  toOrderConditionContext,
  type WorklistItemDto,
  type WorklistQueryDto,
} from '@denimflow/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import type { AuthResponse } from '../auth/auth.service.js';
import {
  ExecutionRepository,
  type InstanceForReadiness,
  type StepForTransition,
  type Tx,
  type WorklistStep,
} from './execution.repository.js';
import { QuantityService } from './quantity.service.js';
import { assertMayWork } from './step-access.js';

type CurrentUser = AuthResponse['user'];

const STARTABLE: StepStatus[] = ['READY', 'REWORK'];
const OPEN_FOR_WORK: StepStatus[] = ['READY', 'IN_PROGRESS', 'REWORK'];

@Injectable()
export class ExecutionService {
  constructor(
    @Inject(ExecutionRepository) private readonly executionRepository: ExecutionRepository,
    @Inject(QuantityService) private readonly quantityService: QuantityService,
  ) {}

  // FR-12: an operator sees only the steps of their own station type; a QC inspector sees QC
  // steps including those waiting for inspection; other roles may filter by station type.
  async getWorklist(user: CurrentUser, query: WorklistQueryDto = {}): Promise<WorklistItemDto[]> {
    const profile = await this.executionRepository.findProfileWithStation(user.id);
    if (!profile) {
      throw new NotFoundException('Không tìm thấy hồ sơ nhân viên');
    }

    const where: Prisma.StepInstanceWhereInput = {};
    if (query.status) {
      where.status = query.status;
    } else if (profile.role === 'QC_INSPECTOR') {
      where.status = { in: [...OPEN_FOR_WORK, 'WAITING_QC'] };
    } else {
      where.status = { in: OPEN_FOR_WORK };
    }

    if (profile.role === 'STATION_OPERATOR') {
      if (!profile.station) {
        return [];
      }
      where.stepDefinition = { stationType: profile.station.stationType };
    } else if (profile.role === 'QC_INSPECTOR') {
      where.stepDefinition = { stepType: 'QC' };
    } else if (query.stationType) {
      where.stepDefinition = { stationType: query.stationType };
    }

    const steps = await this.executionRepository.findWorklistSteps(where);
    return steps.map(toWorklistItem);
  }

  async startStep(stepId: string, user: CurrentUser): Promise<StartStepResponseDto> {
    return this.executionRepository.runInTransaction(async (tx) => {
      const step = await this.loadStep(tx, stepId);
      await assertMayWork(this.executionRepository, tx, step.stepDefinition, user);

      if (!STARTABLE.includes(step.status)) {
        throw new ConflictException(
          `Bước ${step.stepDefinition.code} đang ở trạng thái ${step.status}, chỉ bắt đầu được khi READY hoặc REWORK`,
        );
      }

      const startedAt = new Date();
      // Compare-and-set so two simultaneous "Start" clicks cannot both succeed.
      const changed = await this.executionRepository.transitionStep(tx, stepId, STARTABLE, {
        status: 'IN_PROGRESS',
        startedAt,
        performedBy: user.id,
      });
      if (changed === 0) {
        throw new ConflictException('Bước này vừa được người khác cập nhật, vui lòng tải lại');
      }

      await this.executionRepository.recordAudit(tx, {
        entityType: 'StepInstance',
        entityId: stepId,
        action: 'START_STEP',
        actorId: user.id,
        oldValue: { status: step.status },
        newValue: { status: 'IN_PROGRESS', startedAt: startedAt.toISOString() },
      });

      // State machine (BUSINESS_RECONCILIATION §4): CONFIRMED -> IN_PRODUCTION when cutting starts.
      const order = step.instance.order;
      if (step.stepDefinition.stationType === 'CUTTING' && order.status === 'CONFIRMED') {
        const moved = await this.executionRepository.markOrderInProduction(tx, order.id);
        if (moved === 1) {
          await this.executionRepository.recordAudit(tx, {
            entityType: 'ProductionOrder',
            entityId: order.id,
            action: 'START_PRODUCTION',
            actorId: user.id,
            oldValue: { status: 'CONFIRMED' },
            newValue: { status: 'IN_PRODUCTION' },
          });
        }
      }

      return {
        id: stepId,
        status: 'IN_PROGRESS',
        startedAt: startedAt.toISOString(),
        performedBy: user.id,
      };
    });
  }

  async completeStep(stepId: string, user: CurrentUser): Promise<CompleteStepResponseDto> {
    return this.executionRepository.runInTransaction(async (tx) => {
      const step = await this.loadStep(tx, stepId);
      await assertMayWork(this.executionRepository, tx, step.stepDefinition, user);

      if (step.status !== 'IN_PROGRESS') {
        throw new ConflictException(
          `Bước ${step.stepDefinition.code} đang ở trạng thái ${step.status}, chỉ hoàn thành được khi IN_PROGRESS`,
        );
      }

      // FR-13: quantity steps must balance (BR-08); cutting also creates the bundles (FR-15).
      await this.quantityService.closeOnComplete(tx, stepId, user.id);

      const nextStatus: StepStatus = step.stepDefinition.requiresQc ? 'WAITING_QC' : 'DONE';
      const completedAt = nextStatus === 'DONE' ? new Date() : null;
      const changed = await this.executionRepository.transitionStep(tx, stepId, ['IN_PROGRESS'], {
        status: nextStatus,
        completedAt,
      });
      if (changed === 0) {
        throw new ConflictException('Bước này vừa được người khác cập nhật, vui lòng tải lại');
      }

      await this.executionRepository.recordAudit(tx, {
        entityType: 'StepInstance',
        entityId: stepId,
        action: 'COMPLETE_STEP',
        actorId: user.id,
        oldValue: { status: 'IN_PROGRESS' },
        newValue: { status: nextStatus, completedAt: completedAt?.toISOString() ?? null },
      });

      // A step waiting for QC opens nothing yet; the QC decision (T5.1) does. Completing the
      // last step leaves the order IN_PRODUCTION: packing and handover close it (T5.4).
      const opened =
        nextStatus === 'DONE'
          ? await this.openNextSteps(tx, step.instanceId, user.id)
          : { newlyReadyStepCodes: [], newlySkippedStepCodes: [] };

      return {
        id: stepId,
        status: nextStatus,
        ...(completedAt ? { completedAt: completedAt.toISOString() } : {}),
        ...opened,
      };
    });
  }

  private async loadStep(tx: Tx, stepId: string): Promise<StepForTransition> {
    const step = await this.executionRepository.findStepForTransition(tx, stepId);
    if (!step) {
      throw new NotFoundException('Không tìm thấy bước sản xuất');
    }
    return step;
  }

  // Runs the engine's readiness evaluation (conditions + Gate chain) and applies the result.
  private async openNextSteps(
    tx: Tx,
    instanceId: string,
    actorId: string,
  ): Promise<Pick<CompleteStepResponseDto, 'newlyReadyStepCodes' | 'newlySkippedStepCodes'>> {
    const instance = await this.executionRepository.findInstanceForReadiness(tx, instanceId);
    if (!instance) {
      throw new NotFoundException('Không tìm thấy workflow instance');
    }

    const readiness = evaluateStepReadiness(toReadinessSnapshot(instance));
    const newlyReadyStepCodes: string[] = [];
    const newlySkippedStepCodes: string[] = [];

    for (const change of readiness.changes) {
      const changed = await this.executionRepository.transitionStep(
        tx,
        change.stepId,
        ['PENDING'],
        {
          status: change.toStatus,
        },
      );
      if (changed === 0) {
        continue;
      }
      (change.toStatus === 'READY' ? newlyReadyStepCodes : newlySkippedStepCodes).push(change.code);
      await this.executionRepository.recordAudit(tx, {
        entityType: 'StepInstance',
        entityId: change.stepId,
        action: change.toStatus === 'READY' ? 'STEP_READY' : 'STEP_SKIPPED',
        actorId,
        oldValue: { status: 'PENDING' },
        newValue: { status: change.toStatus, ...(change.reason ? { reason: change.reason } : {}) },
      });
    }

    return { newlyReadyStepCodes, newlySkippedStepCodes };
  }
}

function toReadinessSnapshot(instance: InstanceForReadiness): WorkflowInstanceSnapshot {
  const order = instance.order;
  const fabricLine = order.bomLines.find((line) => line.materialType === 'FABRIC');

  const steps: StepInstanceSnapshot[] = instance.stepInstances.map((s) => ({
    id: s.id,
    code: s.stepDefinition.code,
    name: s.stepDefinition.name,
    seq: s.stepDefinition.seq,
    status: s.status,
    isMandatory: s.stepDefinition.isMandatory,
    requiresEvidence: s.stepDefinition.requiresEvidence,
    requiresQc: s.stepDefinition.requiresQc,
    conditionExpr: s.stepDefinition.conditionExpr,
    qtyIn: s.qtyIn ?? undefined,
    qtyGood: s.qtyGood ?? undefined,
    qtyDefect: s.qtyDefect ?? undefined,
  }));

  return {
    steps,
    // Same context as the Confirm use-case, so conditions agree between plan and execution.
    orderConditionContext: toOrderConditionContext({
      dyeRequired: order.dyeRequired,
      dyeMode: order.dyeMode,
      dyeSource: order.dyeSource,
      embroideryRequired: order.embroideryRequired,
      fabricInspectRequired: order.fabricInspectRequired,
      ppSampleRequired: order.ppSampleRequired,
      skipCleanWash: order.skipCleanWash,
      washTypeId: order.washTypeId,
      isCustom: order.isCustom,
    }),
    fabricBomLine: fabricLine
      ? {
          requiredQty: Number(fabricLine.requiredQty),
          allocatedQty: fabricLine.materialAllocations.reduce(
            (sum, allocation) => sum + Number(allocation.allocatedQty),
            0,
          ),
        }
      : null,
  };
}

function toWorklistItem(step: WorklistStep): WorklistItemDto {
  const order = step.instance.order;
  return {
    id: step.id,
    instanceId: step.instanceId,
    stepCode: step.stepDefinition.code,
    stepName: step.stepDefinition.name,
    stepType: step.stepDefinition.stepType,
    stationType: step.stepDefinition.stationType,
    responsibleRole: step.stepDefinition.responsibleRole,
    status: step.status,
    orderId: order.id,
    orderNumber: order.orderNumber,
    styleCode: order.style.styleCode,
    styleName: order.style.name,
    totalPlannedQty: order.sizeLines.reduce((sum, line) => sum + line.plannedQty, 0),
    qtyIn: step.qtyIn,
    qtyGood: step.qtyGood,
    qtyDefect: step.qtyDefect,
    startedAt: step.startedAt?.toISOString() ?? null,
    completedAt: step.completedAt?.toISOString() ?? null,
    performedBy: step.performedBy,
    reworkCount: step.reworkCount,
    requiresEvidence: step.stepDefinition.requiresEvidence,
    requiresQc: step.stepDefinition.requiresQc,
    isMandatory: step.stepDefinition.isMandatory,
    seq: step.stepDefinition.seq,
  };
}
