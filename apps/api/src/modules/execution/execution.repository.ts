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

const stepForQuantityInclude = {
  stepDefinition: true,
  instance: {
    include: {
      order: { include: { style: true, sizeLines: true } },
      stepInstances: { include: { stepDefinition: true } },
    },
  },
} satisfies Prisma.StepInstanceInclude;

export type StepForQuantity = Prisma.StepInstanceGetPayload<{
  include: typeof stepForQuantityInclude;
}>;

const quantityEntryInclude = {
  bundle: { select: { bundleCode: true } },
  reversedBy: { select: { id: true } },
} satisfies Prisma.StepQuantityEntryInclude;

export type QuantityEntry = Prisma.StepQuantityEntryGetPayload<{
  include: typeof quantityEntryInclude;
}>;

export interface StepQuantities {
  qtyIn: number;
  qtyGood: number;
  qtyDefect: number;
}

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

  findStepForQuantity(
    stepId: string,
    tx: Tx | PrismaService = this.prisma,
  ): Promise<StepForQuantity | null> {
    return tx.stepInstance.findUnique({ where: { id: stepId }, include: stepForQuantityInclude });
  }

  // SELECT ... FOR UPDATE in ascending id order (DATABASE_DESIGN.md §7.2): entries on the same
  // steps then run one after another, and the fixed order avoids deadlocks.
  async lockSteps(tx: Tx, stepIds: string[]): Promise<void> {
    const ids = [...new Set(stepIds)].sort();
    await tx.$queryRaw`SELECT id FROM step_instances WHERE id = ANY(${ids}::uuid[]) ORDER BY id FOR UPDATE`;
  }

  // Re-read after lockSteps: values read before the lock may already be stale.
  findStepsByIds(tx: Tx, stepIds: string[]) {
    return tx.stepInstance.findMany({
      where: { id: { in: stepIds } },
      select: { id: true, status: true, qtyIn: true, qtyGood: true, qtyDefect: true },
    });
  }

  findEntries(stepId: string, tx: Tx | PrismaService = this.prisma): Promise<QuantityEntry[]> {
    return tx.stepQuantityEntry.findMany({
      where: { stepInstanceId: stepId },
      include: quantityEntryInclude,
      orderBy: { enteredAt: 'asc' },
    });
  }

  findEntry(tx: Tx, entryId: string): Promise<QuantityEntry | null> {
    return tx.stepQuantityEntry.findUnique({
      where: { id: entryId },
      include: quantityEntryInclude,
    });
  }

  createEntry(tx: Tx, data: Prisma.StepQuantityEntryUncheckedCreateInput): Promise<QuantityEntry> {
    return tx.stepQuantityEntry.create({ data, include: quantityEntryInclude });
  }

  async setStepQuantities(tx: Tx, stepId: string, totals: StepQuantities): Promise<void> {
    await tx.stepInstance.update({ where: { id: stepId }, data: totals });
  }

  findBundles(orderId: string, tx: Tx | PrismaService = this.prisma) {
    return tx.bundle.findMany({ where: { orderId }, orderBy: { bundleCode: 'asc' } });
  }

  findBundle(tx: Tx, bundleId: string) {
    return tx.bundle.findUnique({ where: { id: bundleId } });
  }

  async createBundles(
    tx: Tx,
    orderId: string,
    bundles: Array<{ bundleCode: string; size: string; qty: number }>,
  ): Promise<void> {
    await tx.bundle.createMany({ data: bundles.map((bundle) => ({ ...bundle, orderId })) });
  }
}
