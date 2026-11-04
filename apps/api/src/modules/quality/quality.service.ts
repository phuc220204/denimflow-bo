import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { evaluateQcInspection, evaluateReworkRouting, type QcEvaluation } from '@denimflow/engine';
import type {
  QcEvaluationDto,
  QcEvaluationInputDto,
  QcInspectionDto,
  RecordQcInspectionDto,
  RecordQcInspectionResponseDto,
} from '@denimflow/shared';
import { BusinessRuleViolation } from '../../common/errors/business-rule-violation.js';
import type { AuthResponse } from '../auth/auth.service.js';
import { ExecutionRepository, type Tx } from '../execution/execution.repository.js';
import { ExecutionService } from '../execution/execution.service.js';
import { assertMayWork, assertNotPerformer } from '../execution/step-access.js';
import {
  type InspectionWithDefects,
  QualityRepository,
  type StepForInspection,
} from './quality.repository.js';

type CurrentUser = AuthResponse['user'];

// R-25: a step is inspected either in line (a production step waiting for QC, e.g. SEWING) or as
// a QC-type step the inspector has started (FABRIC_INSPECT, FINAL_QC).
type InspectionKind = 'IN_LINE' | 'QC_STEP';

function inspectionKind(step: { status: string; stepDefinition: { stepType: string } }) {
  if (step.status === 'WAITING_QC') {
    return 'IN_LINE' satisfies InspectionKind;
  }
  if (step.stepDefinition.stepType === 'QC' && step.status === 'IN_PROGRESS') {
    return 'QC_STEP' satisfies InspectionKind;
  }
  return null;
}

@Injectable()
export class QualityService {
  constructor(
    @Inject(QualityRepository) private readonly qualityRepository: QualityRepository,
    @Inject(ExecutionRepository) private readonly executionRepository: ExecutionRepository,
    @Inject(ExecutionService) private readonly executionService: ExecutionService,
  ) {}

  // Preview of the proposal (no write), so the inspector sees it before confirming.
  async evaluate(stepId: string, input: QcEvaluationInputDto): Promise<QcEvaluationDto> {
    const step = await this.loadStep(stepId);
    if (!inspectionKind(step)) {
      throw this.notInspectable(step);
    }
    return toEvaluationDto(step, this.evaluateFor(step, input));
  }

  // FR-16 / BR-10: each decision, routing change and audit write shares one transaction.
  async recordInspection(
    stepId: string,
    dto: RecordQcInspectionDto,
    user: CurrentUser,
  ): Promise<RecordQcInspectionResponseDto> {
    return this.executionRepository.runInTransaction(async (tx) => {
      const step = await this.loadStep(stepId, tx);
      const routingSteps =
        dto.result === 'PASS'
          ? []
          : await this.qualityRepository.findInstanceSteps(tx, step.instanceId);
      await this.executionRepository.lockSteps(
        tx,
        routingSteps.length ? routingSteps.map((s) => s.id) : [step.id],
      );
      const fresh = await this.loadStep(stepId, tx);
      if (fresh.instance.requiresPlannerReview)
        throw new ConflictException('Đơn hàng đang chờ Điều độ sản xuất xử lý ngoại lệ QC');
      const [current] = await this.executionRepository.findStepsByIds(tx, [step.id]);
      const lockedStep = { ...step, status: current?.status ?? step.status };
      const kind = inspectionKind(lockedStep);
      if (!kind) {
        throw this.notInspectable(lockedStep);
      }

      if (kind === 'QC_STEP') {
        await assertMayWork(this.executionRepository, tx, step.stepDefinition, user);
      } else {
        // BR-11: whoever worked the inspected step may not approve its QC (R-23).
        const performers = await this.executionRepository.findStepPerformers(tx, step.id);
        if (performers) {
          assertNotPerformer(step.stepDefinition.code, performers, user);
        }
      }
      await this.assertBundlesOfOrder(tx, dto, step.instance.order.id);

      const evaluation = this.evaluateFor(step, dto);
      // BR-19: PASS only within the thresholds of the order's QC Profile (R-24).
      if (dto.result === 'PASS' && evaluation.proposedResult !== 'PASS') {
        const failing = evaluation.criteria.filter((c) => !c.passed).map((c) => c.reason);
        throw new BusinessRuleViolation('BR-19', `BR-19: Không thể PASS: ${failing.join('; ')}`);
      }

      let routing: Awaited<ReturnType<QualityService['validateRouting']>> | null = null;
      if (dto.result !== 'PASS') routing = await this.validateRouting(tx, fresh, dto);
      const inspection = await this.qualityRepository.createInspection(tx, {
        stepInstanceId: step.id,
        inspectorId: user.id,
        qcProfileId: step.instance.order.qcProfile?.id ?? null,
        sampleSize: dto.sampleSize,
        measuredShrinkagePercent: dto.measuredShrinkagePercent ?? null,
        measuredColorFadingLevel: dto.measuredColorFadingLevel ?? null,
        proposedResult: evaluation.proposedResult,
        result: dto.result,
        notes: dto.notes ?? null,
        reason: dto.result === 'PASS' ? null : (dto.reason ?? null),
        reworkTargetStepId: dto.result === 'PASS' ? null : (dto.reworkTargetStepId ?? null),
        defects: {
          create: dto.defects.map((defect) => ({
            defectType: defect.defectType,
            qty: defect.qty,
            bundleId: defect.bundleId ?? null,
          })),
        },
      });

      if (routing) {
        const review = dto.result === 'REJECT' || routing.decision.exceedsMaxRework;
        if (review) {
          await this.qualityRepository.flagPlannerReview(tx, step.instanceId, dto.reason!);
          await this.executionRepository.recordAudit(tx, {
            entityType: 'WorkflowInstance',
            entityId: step.instanceId,
            action: 'QC_PLANNER_EXCEPTION',
            actorId: user.id,
            newValue: { reason: dto.reason!, result: dto.result, inspectionId: inspection.id },
          });
        } else {
          // R-06: invalidate the path back to QC; only the rework target stays open (R-26).
          for (const affected of routing.steps.filter(
            (s) =>
              s.stepDefinition.seq >= routing.target.stepDefinition.seq &&
              s.stepDefinition.seq <= step.stepDefinition.seq &&
              s.status !== 'SKIPPED',
          )) {
            const status =
              affected.id === routing.target.id ? ('REWORK' as const) : ('PENDING' as const);
            await this.executionRepository.transitionStep(tx, affected.id, [affected.status], {
              status,
              startedAt: null,
              completedAt: null,
              ...(affected.id === routing.target.id ? { reworkCount: { increment: 1 } } : {}),
            });
            await this.executionRepository.recordAudit(tx, {
              entityType: 'StepInstance',
              entityId: affected.id,
              action: 'QC_REWORK',
              actorId: user.id,
              oldValue: { status: affected.status },
              newValue: { status, inspectionId: inspection.id, reason: dto.reason! },
            });
          }
        }
        await this.executionRepository.recordAudit(tx, {
          entityType: 'QcInspection',
          entityId: inspection.id,
          action: 'QC_INSPECTION',
          actorId: user.id,
          newValue: {
            result: dto.result,
            reason: dto.reason!,
            targetStepId: routing.target.id,
            requiresPlannerReview: review,
          },
        });
        return {
          inspection: toInspectionDto(inspection),
          stepStatus: review
            ? lockedStep.status
            : routing.target.id === step.id
              ? 'REWORK'
              : 'PENDING',
          requiresPlannerReview: review,
          newlyReadyStepCodes: [],
          newlySkippedStepCodes: [],
        };
      }

      const changed = await this.executionRepository.transitionStep(
        tx,
        step.id,
        [lockedStep.status],
        {
          status: 'DONE',
          completedAt: new Date(),
          // An in-line inspection keeps the operator who finished the work as completer.
          ...(kind === 'QC_STEP' ? { completedBy: user.id } : {}),
        },
      );
      if (changed === 0) {
        throw new ConflictException('Bước này vừa được người khác cập nhật, vui lòng tải lại');
      }

      await this.executionRepository.recordAudit(tx, {
        entityType: 'QcInspection',
        entityId: inspection.id,
        action: 'QC_INSPECTION',
        actorId: user.id,
        newValue: {
          stepInstanceId: step.id,
          qcProfileId: inspection.qcProfileId,
          proposedResult: evaluation.proposedResult,
          result: dto.result,
          defectRatePercent: evaluation.defectRatePercent,
        },
      });
      await this.executionRepository.recordAudit(tx, {
        entityType: 'StepInstance',
        entityId: step.id,
        action: 'QC_PASS',
        actorId: user.id,
        oldValue: { status: lockedStep.status },
        newValue: { status: 'DONE' },
      });

      const opened = await this.executionService.openNextSteps(tx, step.instanceId, user.id);
      return { inspection: toInspectionDto(inspection), stepStatus: 'DONE', ...opened };
    });
  }

  async getOrderDefects(orderId: string) {
    const defects = await this.qualityRepository.findOrderDefects(orderId);
    return defects.map((d) => ({
      id: d.id,
      inspectionId: d.inspectionId,
      stepCode: d.inspection.stepInstance.stepDefinition.code,
      stepName: d.inspection.stepInstance.stepDefinition.name,
      bundleId: d.bundleId,
      bundleCode: d.bundle?.bundleCode ?? null,
      size: d.bundle?.size ?? null,
      defectType: d.defectType,
      qty: d.qty,
      inspectorName: d.inspection.inspector.fullName,
      createdAt: d.createdAt.toISOString(),
    }));
  }

  async listInspections(stepId: string): Promise<QcInspectionDto[]> {
    const inspections = await this.qualityRepository.findInspections(stepId);
    return inspections.map(toInspectionDto);
  }

  async listReworkTargets(stepId: string) {
    return this.executionRepository.runInTransaction(async (tx) => {
      const step = await this.loadStep(stepId, tx);
      const [steps, transitions] = await Promise.all([
        this.qualityRepository.findInstanceSteps(tx, step.instanceId),
        this.qualityRepository.findReworkTransitions(
          tx,
          step.instance.versionId,
          step.stepDefinitionId,
        ),
      ]);
      return steps
        .filter(
          (s) =>
            s.status !== 'SKIPPED' &&
            s.stepDefinition.seq <= step.stepDefinition.seq &&
            s.stepDefinition.maxRework !== null &&
            transitions.some((t) => t.toStepId === s.stepDefinitionId),
        )
        .map((s) => ({
          id: s.id,
          code: s.stepDefinition.code,
          name: s.stepDefinition.name,
          seq: s.stepDefinition.seq,
          reworkCount: s.reworkCount,
          maxRework: s.stepDefinition.maxRework!,
        }));
    });
  }

  private async validateRouting(tx: Tx, step: StepForInspection, dto: RecordQcInspectionDto) {
    if (!dto.reason?.trim() || !dto.reworkTargetStepId)
      throw new BusinessRuleViolation('BR-10', 'BR-10: Phải chọn bước quay lại và ghi lý do');
    const steps = await this.qualityRepository.findInstanceSteps(tx, step.instanceId);
    const transitions = await this.qualityRepository.findReworkTransitions(
      tx,
      step.instance.versionId,
      step.stepDefinitionId,
    );
    const target = steps.find((s) => s.id === dto.reworkTargetStepId);
    if (
      !target ||
      target.status === 'SKIPPED' ||
      target.stepDefinition.seq > step.stepDefinition.seq ||
      !transitions.some((t) => t.toStepId === target.stepDefinitionId)
    )
      throw new BusinessRuleViolation(
        'BR-10',
        'BR-10: Bước quay lại không thuộc tuyến REWORK đã xuất bản',
      );
    const decision = evaluateReworkRouting({
      reason: dto.reason,
      reworkCount: target.reworkCount,
      maxRework: target.stepDefinition.maxRework,
    });
    if (!decision.allowed && !decision.exceedsMaxRework)
      throw new BusinessRuleViolation('BR-10', decision.error!);
    return { target, steps, decision };
  }

  private async loadStep(stepId: string, tx?: Tx): Promise<StepForInspection> {
    const step = await this.qualityRepository.findStepForInspection(stepId, tx);
    if (!step) {
      throw new NotFoundException('Không tìm thấy bước sản xuất');
    }
    if (!step.instance.order.qcProfile) {
      throw new ConflictException('Đơn hàng chưa có QC Profile (được chọn khi xác nhận đơn)');
    }
    return step;
  }

  private evaluateFor(step: StepForInspection, input: QcEvaluationInputDto): QcEvaluation {
    const profile = step.instance.order.qcProfile!;
    return evaluateQcInspection(input, {
      profileType: profile.profileType,
      maxShrinkagePercent: Number(profile.maxShrinkagePercent),
      maxColorFadingLevel: profile.maxColorFadingLevel,
    });
  }

  private async assertBundlesOfOrder(
    tx: Tx,
    dto: RecordQcInspectionDto,
    orderId: string,
  ): Promise<void> {
    const bundleIds = [...new Set(dto.defects.flatMap((d) => (d.bundleId ? [d.bundleId] : [])))];
    if (bundleIds.length === 0) {
      return;
    }
    const bundles = await this.qualityRepository.findBundleOrders(tx, bundleIds);
    if (bundles.length !== bundleIds.length || bundles.some((b) => b.orderId !== orderId)) {
      throw new BadRequestException('Có bó trong danh sách lỗi không thuộc đơn hàng này');
    }
  }

  private notInspectable(step: { status: string; stepDefinition: { code: string } }) {
    return new ConflictException(
      `Bước ${step.stepDefinition.code} đang ở trạng thái ${step.status}, chưa thể kiểm tra QC`,
    );
  }
}

function toEvaluationDto(step: StepForInspection, evaluation: QcEvaluation): QcEvaluationDto {
  return { qcProfileId: step.instance.order.qcProfile?.id ?? null, ...evaluation };
}

function toInspectionDto(inspection: InspectionWithDefects): QcInspectionDto {
  return {
    id: inspection.id,
    stepInstanceId: inspection.stepInstanceId,
    inspectorId: inspection.inspectorId,
    qcProfileId: inspection.qcProfileId,
    sampleSize: inspection.sampleSize,
    measuredShrinkagePercent:
      inspection.measuredShrinkagePercent === null
        ? null
        : Number(inspection.measuredShrinkagePercent),
    measuredColorFadingLevel: inspection.measuredColorFadingLevel,
    proposedResult: inspection.proposedResult,
    result: inspection.result,
    notes: inspection.notes,
    reason: inspection.reason,
    reworkTargetStepId: inspection.reworkTargetStepId,
    createdAt: inspection.createdAt.toISOString(),
    defects: inspection.defects.map((defect) => ({
      id: defect.id,
      defectType: defect.defectType,
      qty: defect.qty,
      bundleId: defect.bundleId,
      bundleCode: defect.bundle?.bundleCode ?? null,
    })),
  };
}
