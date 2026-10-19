import { Inject, Injectable } from '@nestjs/common';
import type { StepStatus } from '@denimflow/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

// Read model for FR-21 (BUSINESS_RECONCILIATION R-27): aggregate queries over order and execution
// tables, read-only. Every method is one query, so the dashboard costs a fixed number of round trips.

const openStepSelect = {
  id: true,
  status: true,
  startedAt: true,
  qtyIn: true,
  stepDefinition: {
    select: {
      code: true,
      name: true,
      seq: true,
      stepType: true,
      responsibleRole: true,
      stationType: true,
    },
  },
  instance: {
    select: {
      orderId: true,
      order: { select: { orderNumber: true, style: { select: { styleCode: true } } } },
      // Sibling steps, to find the step that handed the bundles over.
      stepInstances: {
        select: {
          id: true,
          status: true,
          stepDefinition: { select: { seq: true, responsibleRole: true, stationType: true } },
        },
      },
    },
  },
} satisfies Prisma.StepInstanceSelect;

export type OpenStep = Prisma.StepInstanceGetPayload<{ select: typeof openStepSelect }>;

export interface StepTotals {
  stepDefinitionId: string;
  qtyIn: number;
  qtyGood: number;
  qtyDefect: number;
  reworkCount: number;
}

@Injectable()
export class DashboardRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async countOrdersByStatus(): Promise<Array<{ status: string; count: number }>> {
    const rows = await this.prisma.productionOrder.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    return rows.map((row) => ({ status: row.status, count: row._count._all }));
  }

  // step_instances keeps the net entry sums (R-03), so this needs no scan of the entries.
  async sumQuantitiesByStepDefinition(): Promise<StepTotals[]> {
    const rows = await this.prisma.stepInstance.groupBy({
      by: ['stepDefinitionId'],
      _sum: { qtyIn: true, qtyGood: true, qtyDefect: true, reworkCount: true },
    });
    return rows.map((row) => ({
      stepDefinitionId: row.stepDefinitionId,
      qtyIn: row._sum.qtyIn ?? 0,
      qtyGood: row._sum.qtyGood ?? 0,
      qtyDefect: row._sum.qtyDefect ?? 0,
      reworkCount: row._sum.reworkCount ?? 0,
    }));
  }

  findStepDefinitions(ids: string[]) {
    return this.prisma.stepDefinition.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        code: true,
        name: true,
        seq: true,
        responsibleRole: true,
        stationType: true,
      },
      orderBy: [{ seq: 'asc' }, { code: 'asc' }],
    });
  }

  findOpenSteps(statuses: StepStatus[]): Promise<OpenStep[]> {
    return this.prisma.stepInstance.findMany({
      where: { status: { in: statuses }, instance: { status: 'RUNNING' } },
      select: openStepSelect,
      orderBy: [{ stepDefinition: { seq: 'asc' } }, { startedAt: 'asc' }],
    });
  }

  findBundles(orderIds: string[]) {
    return this.prisma.bundle.findMany({
      where: { orderId: { in: orderIds } },
      select: { id: true, orderId: true, qty: true },
    });
  }

  // Net good pieces per (step, bundle): reversal rows carry negated values, so a plain sum is net.
  async sumGoodByStepAndBundle(
    stepInstanceIds: string[],
  ): Promise<Array<{ stepInstanceId: string; bundleId: string; qtyGood: number }>> {
    const rows = await this.prisma.stepQuantityEntry.groupBy({
      by: ['stepInstanceId', 'bundleId'],
      where: { stepInstanceId: { in: stepInstanceIds }, bundleId: { not: null } },
      _sum: { qtyGood: true },
    });
    return rows.flatMap((row) =>
      row.bundleId
        ? [
            {
              stepInstanceId: row.stepInstanceId,
              bundleId: row.bundleId,
              qtyGood: row._sum.qtyGood ?? 0,
            },
          ]
        : [],
    );
  }
}
