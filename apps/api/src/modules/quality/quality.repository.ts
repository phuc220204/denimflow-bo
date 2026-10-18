import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  evaluateQcInspection,
  evaluateReworkRouting,
  evaluateStepReadiness,
  type QcProfileSnapshot,
  type StepInstanceSnapshot,
  type WorkflowInstanceSnapshot,
} from '@denimflow/engine';
import {
  type EvaluateQcInspectionInputDto,
  type OrderDefectItemDto,
  type QcEvaluationOutputDto,
  type QcInspectionResponseDto,
  type RecordQcInspectionDto,
  type ReworkTargetDto,
} from '@denimflow/shared';
import { BusinessRuleViolation } from '../../common/errors/business-rule-violation.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

@Injectable()
export class QualityRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async evaluateInspection(
    stepInstanceId: string,
    input: EvaluateQcInspectionInputDto,
  ): Promise<QcEvaluationOutputDto> {
    const step = await this.prisma.stepInstance.findUnique({
      where: { id: stepInstanceId },
      include: {
        instance: {
          include: {
            order: {
              include: {
                style: {
                  include: { qcProfiles: true },
                },
                qcProfile: true,
              },
            },
          },
        },
      },
    });

    if (!step) {
      throw new NotFoundException(`StepInstance with ID ${stepInstanceId} not found`);
    }

    const order = step.instance.order;
    const targetProfileType = order.skipCleanWash ? 'SKIP_CLEAN_WASH' : 'FULL_PROCESS';

    // Find applicable QC profile
    const profile =
      order.qcProfile ??
      order.style.qcProfiles.find((p) => p.profileType === targetProfileType) ??
      order.style.qcProfiles[0];

    const snapshot: QcProfileSnapshot = {
      id: profile?.id ?? 'default-qc-profile',
      profileType: targetProfileType,
      maxShrinkagePercent: profile?.maxShrinkagePercent ? Number(profile.maxShrinkagePercent) : 4.0,
      maxColorFadingLevel: profile?.maxColorFadingLevel ?? 3,
    };

    return evaluateQcInspection(
      {
        sampleSize: input.sampleSize,
        measuredShrinkagePercent: input.measuredShrinkagePercent,
        measuredColorFadingLevel: input.measuredColorFadingLevel,
        defects: input.defects,
        maxAllowedDefectRatePercent: input.maxAllowedDefectRatePercent,
      },
      snapshot,
    );
  }

  async recordInspection(
    input: RecordQcInspectionDto,
    actorId: string,
    actorRole: string,
  ): Promise<QcInspectionResponseDto> {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Lock step instance row (DATABASE_DESIGN.md §7.3)
      await tx.$executeRaw`SELECT id FROM "step_instances" WHERE id = ${input.stepInstanceId}::uuid FOR UPDATE`;

      const step = await tx.stepInstance.findUnique({
        where: { id: input.stepInstanceId },
        include: {
          stepDefinition: true,
          instance: {
            include: {
              order: {
                include: {
                  style: {
                    include: { qcProfiles: true },
                  },
                  qcProfile: true,
                  sizeLines: true,
                  bomLines: {
                    include: { materialAllocations: true },
                  },
                },
              },
              stepInstances: {
                include: {
                  stepDefinition: {
                    include: { toTransitions: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!step) {
        throw new NotFoundException(`StepInstance with ID ${input.stepInstanceId} not found`);
      }

      // Step must be in WAITING_QC
      if (step.status !== 'WAITING_QC') {
        throw new ConflictException(
          `Step ${step.stepDefinition.code} is in status ${step.status}, cannot record QC inspection (must be WAITING_QC).`,
        );
      }

      // BR-11: Separation of duties - Performer may not approve QC for their own step
      if (step.performedBy && step.performedBy === actorId) {
        throw new BusinessRuleViolation(
          'BR-11',
          'BR-11: Performer may not approve QC for their own step',
        );
      }

      // Only QC_INSPECTOR or ADMIN can confirm QC
      if (actorRole !== 'QC_INSPECTOR' && actorRole !== 'ADMIN') {
        throw new ForbiddenException(
          `Role ${actorRole} is not authorized to record QC inspection (required: QC_INSPECTOR or ADMIN).`,
        );
      }

      const order = step.instance.order;
      const targetProfileType = order.skipCleanWash ? 'SKIP_CLEAN_WASH' : 'FULL_PROCESS';
      const applicableProfile =
        order.qcProfile ??
        order.style.qcProfiles.find((p) => p.profileType === targetProfileType) ??
        order.style.qcProfiles[0];

      // BR-10 / FR-17: Rework routing validation
      let targetStep: {
        id: string;
        status: string;
        reworkCount: number;
        stepDefinition: {
          code: string;
          name: string;
          seq: number;
          maxRework: number | null;
        };
      } | null = null;
      if (input.result === 'REWORK' || input.result === 'REJECT') {
        if (!input.reason || input.reason.trim().length === 0) {
          throw new BusinessRuleViolation(
            'BR-10',
            'BR-10: Lý do làm lại/từ chối là bắt buộc (reason mandatory)',
          );
        }

        if (!input.reworkTargetStepId) {
          throw new BusinessRuleViolation(
            'BR-10',
            'BR-10: Bắt buộc phải chọn công đoạn để làm lại (reworkTargetStepId)',
          );
        }

        // Lock target step row in DB (DATABASE_DESIGN.md §7.3)
        if (input.reworkTargetStepId !== input.stepInstanceId) {
          await tx.$executeRaw`SELECT id FROM "step_instances" WHERE id = ${input.reworkTargetStepId}::uuid FOR UPDATE`;
        }

        targetStep =
          step.instance.stepInstances.find((s) => s.id === input.reworkTargetStepId) ??
          (step.id === input.reworkTargetStepId ? step : null);

        if (!targetStep) {
          throw new BusinessRuleViolation(
            'BR-10',
            'BR-10: Công đoạn làm lại không hợp lệ hoặc không thuộc đơn hàng này',
          );
        }

        const reworkEval = evaluateReworkRouting({
          currentStepId: step.id,
          targetStepId: targetStep.id,
          currentStepSeq: step.stepDefinition.seq,
          targetStepSeq: targetStep.stepDefinition.seq,
          targetReworkCount: targetStep.reworkCount,
          maxRework: targetStep.stepDefinition.maxRework ?? 2,
          reason: input.reason,
        });

        if (reworkEval.exceedsMaxRework) {
          // Flag order for Planner exception handling (BR-10)
          const flagNote = `[FLAGGED_FOR_PLANNER_EXCEPTION: Vượt giới hạn làm lại tại ${targetStep.stepDefinition.name} (${targetStep.reworkCount + 1}/${reworkEval.maxRework})]`;
          const existingNotes = order.notes ?? '';
          const updatedNotes = existingNotes.includes('FLAGGED_FOR_PLANNER_EXCEPTION')
            ? existingNotes
            : (existingNotes ? existingNotes + ' | ' : '') + flagNote;

          await tx.productionOrder.update({
            where: { id: order.id },
            data: { notes: updatedNotes },
          });

          await tx.auditLog.create({
            data: {
              entityType: 'ProductionOrder',
              entityId: order.id,
              action: 'ORDER_FLAGGED_FOR_PLANNER_EXCEPTION',
              actorId,
              oldValue: { notes: order.notes },
              newValue: {
                flag: 'MAX_REWORK_EXCEEDED',
                stepCode: targetStep.stepDefinition.code,
                reworkCount: targetStep.reworkCount + 1,
                maxRework: reworkEval.maxRework,
              },
            },
          });

          throw new BusinessRuleViolation('BR-10', reworkEval.errorMessage!);
        }

        if (!reworkEval.allowed) {
          throw new BusinessRuleViolation('BR-10', reworkEval.errorMessage!);
        }
      }

      // Create QC Inspection record
      const inspection = await tx.qcInspection.create({
        data: {
          stepInstanceId: input.stepInstanceId,
          inspectorId: actorId,
          qcProfileId: applicableProfile?.id ?? null,
          sampleSize: input.sampleSize,
          measuredShrinkagePercent:
            input.measuredShrinkagePercent !== undefined && input.measuredShrinkagePercent !== null
              ? input.measuredShrinkagePercent
              : null,
          measuredColorFadingLevel:
            input.measuredColorFadingLevel !== undefined && input.measuredColorFadingLevel !== null
              ? input.measuredColorFadingLevel
              : null,
          result: input.result,
          reworkTargetStepId: input.reworkTargetStepId ?? null,
          reason: input.reason ?? null,
          notes: input.notes ?? null,
        },
      });

      // Create defect rows if any
      const createdDefects = [];
      if (input.defects && input.defects.length > 0) {
        for (const defect of input.defects) {
          const row = await tx.defect.create({
            data: {
              inspectionId: inspection.id,
              bundleId: defect.bundleId ?? null,
              defectType: defect.defectType,
              qty: defect.qty,
            },
          });
          createdDefects.push(row);
        }
      }

      // Handle Step Status Transition based on QC Result
      if (input.result === 'PASS') {
        const completedAt = new Date();
        await tx.stepInstance.update({
          where: { id: step.id },
          data: {
            status: 'DONE',
            completedAt,
          },
        });

        // Evaluate downstream steps readiness
        const totalPlannedQty = order.sizeLines.reduce((sum, line) => sum + line.plannedQty, 0);
        const fabricBomLine = order.bomLines.find((l) => l.materialType === 'FABRIC');
        const fabricAllocatedQty = fabricBomLine
          ? fabricBomLine.materialAllocations.reduce((sum, a) => sum + Number(a.allocatedQty), 0)
          : 0;

        const allStepSnapshots: StepInstanceSnapshot[] = step.instance.stepInstances.map((s) => {
          const isTarget = s.id === step.id;
          return {
            id: s.id,
            code: s.stepDefinition.code,
            name: s.stepDefinition.name,
            seq: s.stepDefinition.seq,
            status: isTarget ? 'DONE' : s.status,
            isMandatory: s.stepDefinition.isMandatory,
            requiresEvidence: s.stepDefinition.requiresEvidence,
            requiresQc: s.stepDefinition.requiresQc,
            conditionExpr: s.stepDefinition.conditionExpr,
            qtyIn: s.qtyIn ?? undefined,
            qtyGood: s.qtyGood ?? undefined,
            qtyDefect: s.qtyDefect ?? undefined,
          };
        });

        const conditionCtx: Record<string, unknown> = {
          styleId: order.styleId,
          fabricTypeId: order.fabricTypeId,
          colorId: order.colorId,
          washTypeId: order.washTypeId,
          dyeRequired: order.dyeRequired,
          dyeMode: order.dyeMode,
          dyeSource: order.dyeSource,
          embroideryRequired: order.embroideryRequired,
          fabricInspectRequired: order.fabricInspectRequired,
          ppSampleRequired: order.ppSampleRequired,
          skipCleanWash: order.skipCleanWash,
          qcProfileId: order.qcProfileId,
          isCustom: order.isCustom,
          status: order.status,
          dueDate: order.dueDate ? order.dueDate.toISOString() : null,
          orderNumber: order.orderNumber,
          customerRef: order.customerRef,
          notes: order.notes,
          orderQuantity: totalPlannedQty,
          'order.styleId': order.styleId,
          'order.fabricTypeId': order.fabricTypeId,
          'order.colorId': order.colorId,
          'order.washTypeId': order.washTypeId,
          'order.dyeRequired': order.dyeRequired,
          'order.dyeMode': order.dyeMode,
          'order.dyeSource': order.dyeSource,
          'order.embroideryRequired': order.embroideryRequired,
          'order.fabricInspectRequired': order.fabricInspectRequired,
          'order.ppSampleRequired': order.ppSampleRequired,
          'order.skipCleanWash': order.skipCleanWash,
          'order.qcProfileId': order.qcProfileId,
          'order.isCustom': order.isCustom,
          'order.status': order.status,
          'order.dueDate': order.dueDate ? order.dueDate.toISOString() : null,
          'order.orderNumber': order.orderNumber,
          'order.customerRef': order.customerRef,
          'order.notes': order.notes,
          'order.orderQuantity': totalPlannedQty,
        };

        const snapshot: WorkflowInstanceSnapshot = {
          steps: allStepSnapshots,
          orderConditionContext: conditionCtx,
          fabricBomLine: fabricBomLine
            ? {
                requiredQty: Number(fabricBomLine.requiredQty),
                allocatedQty: fabricAllocatedQty,
              }
            : null,
        };

        const readinessOutput = evaluateStepReadiness(snapshot);
        for (const change of readinessOutput.changes) {
          await tx.stepInstance.update({
            where: { id: change.stepId },
            data: { status: change.toStatus },
          });

          await tx.auditLog.create({
            data: {
              entityType: 'StepInstance',
              entityId: change.stepId,
              action: change.toStatus === 'READY' ? 'STEP_READY' : 'STEP_SKIPPED',
              actorId,
              oldValue: { status: change.fromStatus },
              newValue: { status: change.toStatus, reason: change.reason },
            },
          });
        }

        // Check if all steps in instance are DONE or SKIPPED
        const remainingIncomplete = await tx.stepInstance.count({
          where: {
            instanceId: step.instanceId,
            status: { notIn: ['DONE', 'SKIPPED'] },
          },
        });

        if (remainingIncomplete === 0) {
          await tx.workflowInstance.update({
            where: { id: step.instanceId },
            data: { status: 'COMPLETED' },
          });

          await tx.auditLog.create({
            data: {
              entityType: 'WorkflowInstance',
              entityId: step.instanceId,
              action: 'WORKFLOW_COMPLETED',
              actorId,
              oldValue: { status: 'RUNNING' },
              newValue: { status: 'COMPLETED' },
            },
          });
        }
      } else if (input.result === 'REWORK' || input.result === 'REJECT') {
        // T5.2 Rework routing: transition target step to REWORK with incremented reworkCount
        const targetStepId = input.reworkTargetStepId!;
        const currentTarget =
          step.instance.stepInstances.find((s) => s.id === targetStepId) ?? targetStep;

        await tx.stepInstance.update({
          where: { id: targetStepId },
          data: {
            status: 'REWORK',
            reworkCount: { increment: 1 },
          },
        });

        await tx.auditLog.create({
          data: {
            entityType: 'StepInstance',
            entityId: targetStepId,
            action: 'STEP_REWORK_ROUTED',
            actorId,
            oldValue: {
              status: currentTarget?.status ?? 'UNKNOWN',
              reworkCount: currentTarget?.reworkCount ?? 0,
            },
            newValue: {
              status: 'REWORK',
              reworkCount: (currentTarget?.reworkCount ?? 0) + 1,
              fromStepCode: step.stepDefinition.code,
              reason: input.reason,
            },
          },
        });

        // The inspecting step itself also transitions to REWORK if different
        if (targetStepId !== step.id) {
          await tx.stepInstance.update({
            where: { id: step.id },
            data: { status: 'REWORK' },
          });
        }
      }

      // Write AuditLog for QC inspection (BR-16)
      await tx.auditLog.create({
        data: {
          entityType: 'QcInspection',
          entityId: inspection.id,
          action: 'RECORD_QC_INSPECTION',
          actorId,
          oldValue: { stepStatus: step.status },
          newValue: {
            result: input.result,
            sampleSize: input.sampleSize,
            defectCount: createdDefects.length,
            qcProfileId: applicableProfile?.id,
          },
        },
      });

      return {
        id: inspection.id,
        stepInstanceId: inspection.stepInstanceId,
        inspectorId: inspection.inspectorId,
        qcProfileId: inspection.qcProfileId,
        sampleSize: inspection.sampleSize,
        measuredShrinkagePercent: inspection.measuredShrinkagePercent
          ? Number(inspection.measuredShrinkagePercent)
          : null,
        measuredColorFadingLevel: inspection.measuredColorFadingLevel,
        result: inspection.result,
        reworkTargetStepId: inspection.reworkTargetStepId,
        reason: inspection.reason,
        notes: inspection.notes,
        createdAt: inspection.createdAt.toISOString(),
        defects: createdDefects.map((d) => ({
          id: d.id,
          inspectionId: d.inspectionId,
          bundleId: d.bundleId,
          defectType: d.defectType,
          qty: d.qty,
          createdAt: d.createdAt.toISOString(),
        })),
      };
    });
  }

  async getInspections(stepInstanceId: string): Promise<QcInspectionResponseDto[]> {
    const list = await this.prisma.qcInspection.findMany({
      where: { stepInstanceId },
      include: { defects: true },
      orderBy: { createdAt: 'desc' },
    });

    return list.map((i) => ({
      id: i.id,
      stepInstanceId: i.stepInstanceId,
      inspectorId: i.inspectorId,
      qcProfileId: i.qcProfileId,
      sampleSize: i.sampleSize,
      measuredShrinkagePercent: i.measuredShrinkagePercent
        ? Number(i.measuredShrinkagePercent)
        : null,
      measuredColorFadingLevel: i.measuredColorFadingLevel,
      result: i.result,
      reworkTargetStepId: i.reworkTargetStepId,
      reason: i.reason,
      notes: i.notes,
      createdAt: i.createdAt.toISOString(),
      defects: i.defects.map((d) => ({
        id: d.id,
        inspectionId: d.inspectionId,
        bundleId: d.bundleId,
        defectType: d.defectType,
        qty: d.qty,
        createdAt: d.createdAt.toISOString(),
      })),
    }));
  }

  async getReworkTargets(stepInstanceId: string): Promise<ReworkTargetDto[]> {
    const step = await this.prisma.stepInstance.findUnique({
      where: { id: stepInstanceId },
      include: {
        stepDefinition: true,
        instance: {
          include: {
            stepInstances: {
              include: { stepDefinition: true },
              orderBy: { stepDefinition: { seq: 'asc' } },
            },
          },
        },
      },
    });

    if (!step) {
      throw new NotFoundException(`StepInstance with ID ${stepInstanceId} not found`);
    }

    return step.instance.stepInstances
      .filter((s) => s.stepDefinition.seq <= step.stepDefinition.seq)
      .map((s) => ({
        id: s.id,
        code: s.stepDefinition.code,
        name: s.stepDefinition.name,
        seq: s.stepDefinition.seq,
        status: s.status,
        reworkCount: s.reworkCount,
        maxRework: s.stepDefinition.maxRework ?? 2,
      }));
  }

  async getOrderDefects(orderId: string): Promise<OrderDefectItemDto[]> {
    const defects = await this.prisma.defect.findMany({
      where: {
        inspection: {
          stepInstance: {
            instance: {
              orderId,
            },
          },
        },
      },
      include: {
        inspection: {
          include: {
            stepInstance: {
              include: {
                stepDefinition: true,
              },
            },
            inspector: true,
          },
        },
        bundle: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

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
}
