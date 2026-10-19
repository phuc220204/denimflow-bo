import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { evaluateQcInspection, type QcEvaluation } from '@denimflow/engine';
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

  // FR-16: records the inspection; a PASS completes the step and opens the next ones. REWORK and
  // REJECT need a target step, a reason and the loop limit (BR-10): they arrive with T5.2.
  async recordInspection(
    stepId: string,
    dto: RecordQcInspectionDto,
    user: CurrentUser,
  ): Promise<RecordQcInspectionResponseDto> {
    if (dto.result !== 'PASS') {
      throw new ConflictException(
        'Hiện chỉ ghi nhận được kết quả PASS; REWORK/REJECT sẽ có khi bổ sung định tuyến làm lại (T5.2)',
      );
    }

    return this.executionRepository.runInTransaction(async (tx) => {
      const step = await this.loadStep(stepId, tx);
      await this.executionRepository.lockSteps(tx, [step.id]);
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
      if (evaluation.proposedResult !== 'PASS') {
        const failing = evaluation.criteria.filter((c) => !c.passed).map((c) => c.reason);
        throw new BusinessRuleViolation('BR-19', `BR-19: Không thể PASS: ${failing.join('; ')}`);
      }

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
        defects: {
          create: dto.defects.map((defect) => ({
            defectType: defect.defectType,
            qty: defect.qty,
            bundleId: defect.bundleId ?? null,
          })),
        },
      });

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

  async listInspections(stepId: string): Promise<QcInspectionDto[]> {
    const inspections = await this.qualityRepository.findInspections(stepId);
    return inspections.map(toInspectionDto);
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
