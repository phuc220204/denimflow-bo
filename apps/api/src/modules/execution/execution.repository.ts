import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AttachEvidenceDto,
  BundleDto,
  CompleteStepResponseDto,
  EvidenceDto,
  RecordQuantityEntryDto,
  StartStepResponseDto,
  StepQuantityEntryDto,
  StepStatus,
  WorklistItemDto,
  WorklistQueryDto,
} from '@denimflow/shared';
import {
  evaluateStepReadiness,
  generateBundlesForCutting,
  type StepInstanceSnapshot,
  validateQuantityEntry,
  type WorkflowInstanceSnapshot,
} from '@denimflow/engine';
import { BusinessRuleViolation } from '../../common/errors/business-rule-violation.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

@Injectable()
export class ExecutionRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getWorklist(userId: string, query?: WorklistQueryDto): Promise<WorklistItemDto[]> {
    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
      include: { station: true },
    });

    if (!profile) {
      throw new NotFoundException(`Profile with ID ${userId} not found`);
    }

    // Role-specific filtering
    const whereClause: Prisma.StepInstanceWhereInput = {};

    const defaultStatuses: StepStatus[] = ['READY', 'IN_PROGRESS', 'REWORK'];

    if (query?.status) {
      whereClause.status = query.status;
    } else if (profile.role === 'QC_INSPECTOR') {
      whereClause.status = { in: ['READY', 'IN_PROGRESS', 'REWORK', 'WAITING_QC'] };
    } else {
      whereClause.status = { in: defaultStatuses };
    }

    if (profile.role === 'STATION_OPERATOR') {
      if (!profile.station) {
        return [];
      }
      whereClause.stepDefinition = {
        stationType: profile.station.stationType,
      };
    } else if (profile.role === 'QC_INSPECTOR') {
      whereClause.stepDefinition = {
        stepType: 'QC',
      };
    } else if (query?.stationType) {
      whereClause.stepDefinition = {
        stationType: query.stationType,
      };
    }

    const stepInstances = await this.prisma.stepInstance.findMany({
      where: whereClause,
      include: {
        stepDefinition: true,
        instance: {
          include: {
            order: {
              include: {
                style: true,
                sizeLines: true,
              },
            },
          },
        },
      },
      orderBy: [{ stepDefinition: { seq: 'asc' } }, { createdAt: 'asc' }],
    });

    return stepInstances.map((step) => {
      const totalPlannedQty = step.instance.order.sizeLines.reduce(
        (sum, line) => sum + line.plannedQty,
        0,
      );

      return {
        id: step.id,
        instanceId: step.instanceId,
        stepCode: step.stepDefinition.code,
        stepName: step.stepDefinition.name,
        stepType: step.stepDefinition.stepType,
        stationType: step.stepDefinition.stationType,
        responsibleRole: step.stepDefinition.responsibleRole,
        status: step.status,
        orderId: step.instance.order.id,
        orderNumber: step.instance.order.orderNumber,
        styleCode: step.instance.order.style.styleCode,
        styleName: step.instance.order.style.name,
        totalPlannedQty,
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
    });
  }

  async startStep(
    stepId: string,
    actorId: string,
    actorRole: string,
  ): Promise<StartStepResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Lock step instance row
      const step = await tx.stepInstance.findUnique({
        where: { id: stepId },
        include: {
          stepDefinition: true,
          instance: {
            include: {
              order: true,
            },
          },
        },
      });

      if (!step) {
        throw new NotFoundException(`StepInstance with ID ${stepId} not found`);
      }

      // BR-11: Process Engineer may not confirm completion or start production steps
      if (actorRole === 'PROCESS_ENGINEER' && step.stepDefinition.stepType === 'PRODUCTION') {
        throw new BusinessRuleViolation(
          'BR-11',
          'BR-11: Process Engineer may not start or execute production steps',
        );
      }

      // Step status must be READY or REWORK
      if (step.status !== 'READY' && step.status !== 'REWORK') {
        throw new ConflictException(
          `Step ${step.stepDefinition.code} is in status ${step.status}, cannot be started (must be READY or REWORK).`,
        );
      }

      // Station operator station match check
      if (actorRole === 'STATION_OPERATOR') {
        const actorProfile = await tx.profile.findUnique({
          where: { id: actorId },
          include: { station: true },
        });

        if (
          step.stepDefinition.stationType &&
          actorProfile?.station?.stationType !== step.stepDefinition.stationType
        ) {
          throw new ForbiddenException(
            `Operator station (${actorProfile?.station?.stationType}) does not match step station (${step.stepDefinition.stationType}).`,
          );
        }
      }

      const startedAt = new Date();

      // Update step instance
      const updatedStep = await tx.stepInstance.update({
        where: { id: stepId },
        data: {
          status: 'IN_PROGRESS',
          startedAt,
          performedBy: actorId,
        },
      });

      // If CUTTING starts and order is CONFIRMED, advance order to IN_PRODUCTION
      if (step.stepDefinition.code === 'CUTTING' && step.instance.order.status === 'CONFIRMED') {
        await tx.productionOrder.update({
          where: { id: step.instance.order.id },
          data: { status: 'IN_PRODUCTION' },
        });

        await tx.auditLog.create({
          data: {
            entityType: 'ProductionOrder',
            entityId: step.instance.order.id,
            action: 'START_PRODUCTION',
            actorId,
            oldValue: { status: 'CONFIRMED' },
            newValue: { status: 'IN_PRODUCTION' },
          },
        });
      }

      // Write AuditLog for step instance (BR-16)
      await tx.auditLog.create({
        data: {
          entityType: 'StepInstance',
          entityId: stepId,
          action: 'START_STEP',
          actorId,
          oldValue: { status: step.status },
          newValue: {
            status: 'IN_PROGRESS',
            startedAt: startedAt.toISOString(),
            performedBy: actorId,
          },
        },
      });

      return {
        id: updatedStep.id,
        status: updatedStep.status,
        startedAt: startedAt.toISOString(),
        performedBy: actorId,
      };
    });
  }

  async completeStep(
    stepId: string,
    actorId: string,
    actorRole: string,
  ): Promise<CompleteStepResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Lock step instance
      const step = await tx.stepInstance.findUnique({
        where: { id: stepId },
        include: {
          stepDefinition: true,
          instance: {
            include: {
              order: {
                include: {
                  style: true,
                  fabricType: true,
                  washType: true,
                  sizeLines: true,
                  bomLines: {
                    include: { materialAllocations: true },
                  },
                },
              },
              stepInstances: {
                include: {
                  stepDefinition: {
                    include: {
                      toTransitions: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!step) {
        throw new NotFoundException(`StepInstance with ID ${stepId} not found`);
      }

      // BR-11: Process Engineer may not confirm completion of production steps
      if (actorRole === 'PROCESS_ENGINEER' && step.stepDefinition.stepType === 'PRODUCTION') {
        throw new BusinessRuleViolation(
          'BR-11',
          'BR-11: Process Engineer may not confirm completion of production steps',
        );
      }

      // Must be IN_PROGRESS
      if (step.status !== 'IN_PROGRESS') {
        throw new ConflictException(
          `Step ${step.stepDefinition.code} is in status ${step.status}, cannot be completed (must be IN_PROGRESS).`,
        );
      }

      // BR-15: Evidence check
      if (step.stepDefinition.requiresEvidence) {
        const evidenceCount = await tx.evidence.count({
          where: { stepInstanceId: stepId },
        });

        if (evidenceCount === 0) {
          throw new BusinessRuleViolation(
            'BR-15',
            `BR-15: Step ${step.stepDefinition.code} requires at least 1 evidence attachment before completion.`,
          );
        }
      }

      const nextStatus: StepStatus = step.stepDefinition.requiresQc ? 'WAITING_QC' : 'DONE';
      const completedAt = nextStatus === 'DONE' ? new Date() : null;

      // Update step instance
      await tx.stepInstance.update({
        where: { id: stepId },
        data: {
          status: nextStatus,
          completedAt,
          performedBy: step.performedBy || actorId,
        },
      });

      // Write AuditLog (BR-16)
      await tx.auditLog.create({
        data: {
          entityType: 'StepInstance',
          entityId: stepId,
          action: 'COMPLETE_STEP',
          actorId,
          oldValue: { status: step.status },
          newValue: {
            status: nextStatus,
            completedAt: completedAt?.toISOString() ?? null,
            performedBy: step.performedBy || actorId,
          },
        },
      });

      const newlyReadyStepCodes: string[] = [];
      const newlySkippedStepCodes: string[] = [];

      // If step is DONE, evaluate downstream steps readiness
      if (nextStatus === 'DONE') {
        const order = step.instance.order;
        const totalPlannedQty = order.sizeLines.reduce((sum, line) => sum + line.plannedQty, 0);

        const fabricBomLine = order.bomLines.find((l) => l.materialType === 'FABRIC');
        const fabricAllocatedQty = fabricBomLine
          ? fabricBomLine.materialAllocations.reduce((sum, a) => sum + Number(a.allocatedQty), 0)
          : 0;

        const allStepSnapshots: StepInstanceSnapshot[] = step.instance.stepInstances.map((s) => {
          const isTarget = s.id === stepId;
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

        const snapshot: WorkflowInstanceSnapshot = {
          steps: allStepSnapshots,
          orderConditionContext: {
            orderQuantity: totalPlannedQty,
            washType: order.washType?.code || 'RAW',
            fabricWeightOz: order.fabricType?.weightOz ? Number(order.fabricType.weightOz) : 12,
            hasRipEffect: false,
            hasEmbroidery: order.embroideryRequired,
          },
          fabricBomLine: fabricBomLine
            ? {
                requiredQty: Number(fabricBomLine.requiredQty),
                allocatedQty: fabricAllocatedQty,
              }
            : null,
        };

        const readinessOutput = evaluateStepReadiness(snapshot);

        // Apply changes to database
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

          if (change.toStatus === 'READY') {
            newlyReadyStepCodes.push(change.code);
          } else if (change.toStatus === 'SKIPPED') {
            newlySkippedStepCodes.push(change.code);
          }
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

          await tx.productionOrder.update({
            where: { id: order.id },
            data: { status: 'COMPLETED' },
          });

          await tx.auditLog.create({
            data: {
              entityType: 'ProductionOrder',
              entityId: order.id,
              action: 'ORDER_COMPLETED',
              actorId,
              oldValue: { status: order.status },
              newValue: { status: 'COMPLETED' },
            },
          });
        }
      }

      return {
        id: stepId,
        status: nextStatus,
        completedAt: completedAt?.toISOString(),
        newlyReadyStepCodes,
        newlySkippedStepCodes,
      };
    });
  }

  async recordQuantity(
    stepId: string,
    input: RecordQuantityEntryDto,
    actorId: string,
    actorRole: string,
  ): Promise<StepQuantityEntryDto> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Fetch step instance to identify workflow instance and order
      const step = await tx.stepInstance.findUnique({
        where: { id: stepId },
        include: {
          stepDefinition: true,
          instance: {
            include: {
              order: {
                include: { sizeLines: true },
              },
              stepInstances: {
                include: { stepDefinition: true },
              },
            },
          },
        },
      });

      if (!step) {
        throw new NotFoundException(`StepInstance with ID ${stepId} not found`);
      }

      // BR-11: Process Engineer may not enter production quantities
      if (actorRole === 'PROCESS_ENGINEER' && step.stepDefinition.stepType === 'PRODUCTION') {
        throw new BusinessRuleViolation(
          'BR-11',
          'BR-11: Process Engineer may not enter production quantities',
        );
      }

      // Identify previous step in workflow sequence
      const previousSteps = step.instance.stepInstances
        .filter((s) => s.stepDefinition.seq < step.stepDefinition.seq && s.status !== 'SKIPPED')
        .sort((a, b) => b.stepDefinition.seq - a.stepDefinition.seq);
      const previousStep = previousSteps.length > 0 ? previousSteps[0] : null;

      // Pessimistic Locking: Lock current step and previous step in ascending ID order (DATABASE_DESIGN.md §7.2)
      const idsToLock = [step.id, previousStep?.id]
        .filter((id): id is string => Boolean(id))
        .sort();
      for (const id of idsToLock) {
        await tx.$executeRaw`SELECT id FROM "step_instances" WHERE id = ${id}::uuid FOR UPDATE`;
      }

      // Existing entries for this step
      const existingEntries = await tx.stepQuantityEntry.findMany({
        where: { stepInstanceId: stepId },
      });

      const currentStepTotalGoodSoFar = existingEntries.reduce((sum, e) => sum + e.qtyGood, 0);

      const isCutting = step.stepDefinition.code === 'CUTTING';
      let targetSize = input.size;

      if (!targetSize && input.bundleId) {
        const bundle = await tx.bundle.findUnique({ where: { id: input.bundleId } });
        if (bundle) {
          targetSize = bundle.size;
        }
      }

      let plannedQtyForSize: number | undefined;
      let existingCutQtyForSize: number | undefined;

      if (isCutting && targetSize) {
        const sizeLine = step.instance.order.sizeLines.find((sl) => sl.size === targetSize);
        plannedQtyForSize = sizeLine?.plannedQty ?? 0;
        existingCutQtyForSize = existingEntries
          .filter((e) => e.size === targetSize)
          .reduce((sum, e) => sum + e.qtyGood + e.qtyDefect, 0);
      }

      const isOutsourced =
        step.stepDefinition.stationType === 'DYEING' ||
        step.stepDefinition.stationType === 'WASH' ||
        input.qtySent !== undefined;

      // Validate using pure engine rules (BR-07, BR-08, BR-09)
      const validation = validateQuantityEntry({
        stepCode: step.stepDefinition.code,
        isCutting,
        plannedQtyForSize,
        cutTolerancePercent: 5,
        existingCutQtyForSize,
        entryQtyGood: input.qtyGood,
        entryQtyDefect: input.qtyDefect ?? 0,
        previousStepGoodQty: previousStep?.qtyGood ?? undefined,
        currentStepTotalGoodSoFar,
        isOutsourced,
        qtySent: input.qtySent,
        qtyReceived: input.qtyReceived,
        mismatchReason: input.mismatchReason,
      });

      if (!validation.valid) {
        throw new BusinessRuleViolation(
          validation.ruleId ?? 'BR-08',
          validation.reason ?? 'Quantity validation failed',
        );
      }

      // Insert quantity entry
      const entry = await tx.stepQuantityEntry.create({
        data: {
          stepInstanceId: stepId,
          bundleId: input.bundleId,
          size: targetSize,
          qtyGood: input.qtyGood,
          qtyDefect: input.qtyDefect ?? 0,
          qtySent: input.qtySent,
          qtyReceived: input.qtyReceived,
          mismatchReason: input.mismatchReason,
          note: input.note,
          enteredBy: actorId,
        },
      });

      // Update aggregates on step_instances
      const totalGood = currentStepTotalGoodSoFar + input.qtyGood;
      const totalDefect =
        existingEntries.reduce((sum, e) => sum + e.qtyDefect, 0) + (input.qtyDefect ?? 0);
      const qtyIn = isCutting ? totalGood + totalDefect : (previousStep?.qtyGood ?? totalGood);

      await tx.stepInstance.update({
        where: { id: stepId },
        data: {
          qtyIn,
          qtyGood: totalGood,
          qtyDefect: totalDefect,
        },
      });

      // Update bundle current step if bundle provided
      if (input.bundleId) {
        await tx.bundle.update({
          where: { id: input.bundleId },
          data: { currentStepInstanceId: stepId },
        });
      }

      // Audit log (BR-16)
      await tx.auditLog.create({
        data: {
          entityType: 'StepQuantityEntry',
          entityId: entry.id,
          action: 'RECORD_QUANTITY',
          actorId,
          newValue: {
            stepInstanceId: stepId,
            bundleId: input.bundleId,
            size: targetSize,
            qtyGood: input.qtyGood,
            qtyDefect: input.qtyDefect ?? 0,
            stepTotalGood: totalGood,
            stepTotalDefect: totalDefect,
          },
        },
      });

      return {
        id: entry.id,
        stepInstanceId: entry.stepInstanceId,
        bundleId: entry.bundleId,
        size: entry.size,
        qtyGood: entry.qtyGood,
        qtyDefect: entry.qtyDefect,
        qtySent: entry.qtySent,
        qtyReceived: entry.qtyReceived,
        mismatchReason: entry.mismatchReason,
        note: entry.note,
        enteredBy: entry.enteredBy,
        enteredAt: entry.enteredAt.toISOString(),
      };
    });
  }

  async generateBundles(stepId: string, actorId: string): Promise<BundleDto[]> {
    return this.prisma.$transaction(async (tx) => {
      const step = await tx.stepInstance.findUnique({
        where: { id: stepId },
        include: {
          stepDefinition: true,
          instance: {
            include: {
              order: {
                include: {
                  sizeLines: true,
                  bundles: true,
                },
              },
            },
          },
        },
      });

      if (!step) {
        throw new NotFoundException(`StepInstance with ID ${stepId} not found`);
      }

      const order = step.instance.order;
      if (order.bundles.length > 0) {
        return order.bundles.map((b) => ({
          id: b.id,
          orderId: b.orderId,
          bundleCode: b.bundleCode,
          size: b.size,
          qty: b.qty,
          currentStepInstanceId: b.currentStepInstanceId,
          createdAt: b.createdAt.toISOString(),
          updatedAt: b.updatedAt.toISOString(),
        }));
      }

      const generated = generateBundlesForCutting(
        order.orderNumber,
        order.sizeLines.map((sl) => ({ size: sl.size, plannedQty: sl.plannedQty })),
      );

      const createdBundles: BundleDto[] = [];
      for (const b of generated) {
        const created = await tx.bundle.create({
          data: {
            orderId: order.id,
            bundleCode: b.bundleCode,
            size: b.size,
            qty: b.qty,
            currentStepInstanceId: stepId,
          },
        });
        createdBundles.push({
          id: created.id,
          orderId: created.orderId,
          bundleCode: created.bundleCode,
          size: created.size,
          qty: created.qty,
          currentStepInstanceId: created.currentStepInstanceId,
          createdAt: created.createdAt.toISOString(),
          updatedAt: created.updatedAt.toISOString(),
        });
      }

      await tx.auditLog.create({
        data: {
          entityType: 'ProductionOrder',
          entityId: order.id,
          action: 'GENERATE_BUNDLES',
          actorId,
          newValue: { bundleCount: createdBundles.length },
        },
      });

      return createdBundles;
    });
  }

  async getBundles(stepId: string): Promise<BundleDto[]> {
    const step = await this.prisma.stepInstance.findUnique({
      where: { id: stepId },
      include: {
        instance: {
          include: {
            order: {
              include: { bundles: { orderBy: { bundleCode: 'asc' } } },
            },
          },
        },
      },
    });

    if (!step) {
      throw new NotFoundException(`StepInstance with ID ${stepId} not found`);
    }

    return step.instance.order.bundles.map((b) => ({
      id: b.id,
      orderId: b.orderId,
      bundleCode: b.bundleCode,
      size: b.size,
      qty: b.qty,
      currentStepInstanceId: b.currentStepInstanceId,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
    }));
  }

  async getQuantityEntries(stepId: string): Promise<StepQuantityEntryDto[]> {
    const entries = await this.prisma.stepQuantityEntry.findMany({
      where: { stepInstanceId: stepId },
      orderBy: { enteredAt: 'desc' },
    });

    return entries.map((e) => ({
      id: e.id,
      stepInstanceId: e.stepInstanceId,
      bundleId: e.bundleId,
      size: e.size,
      qtyGood: e.qtyGood,
      qtyDefect: e.qtyDefect,
      qtySent: e.qtySent,
      qtyReceived: e.qtyReceived,
      mismatchReason: e.mismatchReason,
      note: e.note,
      enteredBy: e.enteredBy,
      enteredAt: e.enteredAt.toISOString(),
    }));
  }

  async attachEvidence(
    stepId: string,
    input: AttachEvidenceDto,
    actorId: string,
  ): Promise<EvidenceDto> {
    return this.prisma.$transaction(async (tx) => {
      const step = await tx.stepInstance.findUnique({
        where: { id: stepId },
      });

      if (!step) {
        throw new NotFoundException(`StepInstance with ID ${stepId} not found`);
      }

      const evidence = await tx.evidence.create({
        data: {
          stepInstanceId: stepId,
          filePath: input.filePath,
          note: input.note,
          uploadedBy: actorId,
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: 'Evidence',
          entityId: evidence.id,
          action: 'ATTACH_EVIDENCE',
          actorId,
          newValue: {
            stepInstanceId: stepId,
            filePath: input.filePath,
            note: input.note,
          },
        },
      });

      return {
        id: evidence.id,
        stepInstanceId: evidence.stepInstanceId,
        filePath: evidence.filePath,
        note: evidence.note,
        uploadedBy: evidence.uploadedBy,
        uploadedAt: evidence.uploadedAt.toISOString(),
      };
    });
  }

  async getEvidence(stepId: string): Promise<EvidenceDto[]> {
    const records = await this.prisma.evidence.findMany({
      where: { stepInstanceId: stepId },
      orderBy: { uploadedAt: 'desc' },
    });

    return records.map((e) => ({
      id: e.id,
      stepInstanceId: e.stepInstanceId,
      filePath: e.filePath,
      note: e.note,
      uploadedBy: e.uploadedBy,
      uploadedAt: e.uploadedAt.toISOString(),
    }));
  }
}
