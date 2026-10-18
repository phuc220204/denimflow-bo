import { Inject, Injectable } from '@nestjs/common';
import type { Prisma, StepStatus } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

export type Tx = Prisma.TransactionClient;

const stepForTransitionInclude = {
  stepDefinition: true,
  instance: { include: { order: true } },
} satisfies Prisma.StepInstanceInclude;

export type StepForTransition = Prisma.StepInstanceGetPayload<{
  include: typeof stepForTransitionInclude;
}>;

const instanceForReadinessInclude = {
  order: { include: { bomLines: { include: { materialAllocations: true } } } },
  stepInstances: { include: { stepDefinition: true } },
} satisfies Prisma.WorkflowInstanceInclude;

export type InstanceForReadiness = Prisma.WorkflowInstanceGetPayload<{
  include: typeof instanceForReadinessInclude;
}>;

const worklistInclude = {
  stepDefinition: true,
  instance: { include: { order: { include: { style: true, sizeLines: true } } } },
} satisfies Prisma.StepInstanceInclude;

export type WorklistStep = Prisma.StepInstanceGetPayload<{ include: typeof worklistInclude }>;

export interface AuditEntry {
  entityType: string;
  entityId: string;
  action: string;
  actorId: string;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
}

// Data access only (rule 01): the rules about who may start or complete a step live in
// ExecutionService. Writes take the open transaction so the service controls atomicity.
@Injectable()
export class ExecutionRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  runInTransaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(work, { timeout: 15_000 });
  }

  findProfileWithStation(userId: string, tx: Tx | PrismaService = this.prisma) {
    return tx.profile.findUnique({ where: { id: userId }, include: { station: true } });
  }

  findWorklistSteps(where: Prisma.StepInstanceWhereInput): Promise<WorklistStep[]> {
    return this.prisma.stepInstance.findMany({
      where,
      include: worklistInclude,
      orderBy: [{ stepDefinition: { seq: 'asc' } }, { createdAt: 'asc' }],
    });
  }

  findStepForTransition(tx: Tx, stepId: string): Promise<StepForTransition | null> {
    return tx.stepInstance.findUnique({ where: { id: stepId }, include: stepForTransitionInclude });
  }

  findInstanceForReadiness(tx: Tx, instanceId: string): Promise<InstanceForReadiness | null> {
    return tx.workflowInstance.findUnique({
      where: { id: instanceId },
      include: instanceForReadinessInclude,
    });
  }

  // Compare-and-set: only updates when the step is still in one of `fromStatuses`. Returns the
  // number of rows changed (0 = someone else changed the step first).
  async transitionStep(
    tx: Tx,
    stepId: string,
    fromStatuses: StepStatus[],
    data: Prisma.StepInstanceUncheckedUpdateManyInput,
  ): Promise<number> {
    const result = await tx.stepInstance.updateMany({
      where: { id: stepId, status: { in: fromStatuses } },
      data,
    });
    return result.count;
  }

  async markOrderInProduction(tx: Tx, orderId: string): Promise<number> {
    const result = await tx.productionOrder.updateMany({
      where: { id: orderId, status: 'CONFIRMED' },
      data: { status: 'IN_PRODUCTION' },
    });
    return result.count;
  }

  async recordAudit(tx: Tx, entry: AuditEntry): Promise<void> {
    await tx.auditLog.create({ data: entry });
  }
}
