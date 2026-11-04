import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import type { Tx } from '../execution/execution.repository.js';

const stepForInspectionInclude = {
  stepDefinition: true,
  instance: { include: { order: { include: { qcProfile: true } } } },
} satisfies Prisma.StepInstanceInclude;

export type StepForInspection = Prisma.StepInstanceGetPayload<{
  include: typeof stepForInspectionInclude;
}>;

const inspectionInclude = {
  defects: { include: { bundle: { select: { bundleCode: true } } }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.QcInspectionInclude;

export type InspectionWithDefects = Prisma.QcInspectionGetPayload<{
  include: typeof inspectionInclude;
}>;

// Data access only (rule 01): the QC rules live in QualityService.
@Injectable()
export class QualityRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  findStepForInspection(
    stepId: string,
    tx: Tx | PrismaService = this.prisma,
  ): Promise<StepForInspection | null> {
    return tx.stepInstance.findUnique({ where: { id: stepId }, include: stepForInspectionInclude });
  }

  findBundleOrders(tx: Tx, bundleIds: string[]) {
    return tx.bundle.findMany({
      where: { id: { in: bundleIds } },
      select: { id: true, orderId: true },
    });
  }

  createInspection(
    tx: Tx,
    data: Prisma.QcInspectionUncheckedCreateInput,
  ): Promise<InspectionWithDefects> {
    return tx.qcInspection.create({ data, include: inspectionInclude });
  }

  findInspections(stepId: string): Promise<InspectionWithDefects[]> {
    return this.prisma.qcInspection.findMany({
      where: { stepInstanceId: stepId },
      include: inspectionInclude,
      orderBy: { createdAt: 'desc' },
    });
  }
}
