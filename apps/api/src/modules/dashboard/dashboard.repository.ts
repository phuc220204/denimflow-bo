import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { DashboardWipSummaryDto, OrderStatus, StationType } from '@denimflow/shared';

@Injectable()
export class DashboardRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getWipSummary(): Promise<DashboardWipSummaryDto> {
    const ordersByStatus: Record<OrderStatus, number> = {
      DRAFT: 0,
      CONFIRMED: 0,
      IN_PRODUCTION: 0,
      ON_HOLD: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };

    const orderCounts = await this.prisma.productionOrder.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    for (const entry of orderCounts) {
      if (entry.status in ordersByStatus) {
        ordersByStatus[entry.status as OrderStatus] = entry._count.id;
      }
    }

    const totalOrders = Object.values(ordersByStatus).reduce((a, b) => a + b, 0);
    const activeOrders = ordersByStatus.CONFIRMED + ordersByStatus.IN_PRODUCTION;
    const completedOrders = ordersByStatus.COMPLETED;

    const stepAggregates = await this.prisma.stepInstance.aggregate({
      _sum: {
        qtyGood: true,
        qtyDefect: true,
        reworkCount: true,
      },
    });

    const waitingQcSteps = await this.prisma.stepInstance.findMany({
      where: {
        status: 'WAITING_QC',
      },
      include: {
        stepDefinition: true,
        instance: {
          include: {
            order: {
              include: {
                style: true,
              },
            },
          },
        },
      },
      orderBy: {
        startedAt: 'asc',
      },
    });

    const waitingQcOrders = waitingQcSteps.map((step) => ({
      orderId: step.instance.order.id,
      orderNumber: step.instance.order.orderNumber,
      styleCode: step.instance.order.style.styleCode,
      stepInstanceId: step.id,
      stepCode: step.stepDefinition.code,
      stepName: step.stepDefinition.name,
      stationType: (step.stepDefinition.stationType as StationType | null) ?? null,
      startedAt: step.startedAt?.toISOString() ?? null,
    }));

    const activeStepInstances = await this.prisma.stepInstance.findMany({
      where: {
        status: {
          in: ['READY', 'IN_PROGRESS', 'WAITING_QC', 'REWORK'],
        },
        instance: {
          status: 'RUNNING',
        },
      },
      include: {
        stepDefinition: true,
        currentBundles: true,
      },
      orderBy: [{ stepDefinition: { seq: 'asc' } }, { stepDefinition: { code: 'asc' } }],
    });

    const stationMap = new Map<
      string,
      {
        stationType: StationType | null;
        stepCode: string;
        stepName: string;
        activeStepCount: number;
        totalQtyIn: number;
        totalQtyGood: number;
        totalQtyDefect: number;
        bundleCount: number;
      }
    >();

    for (const step of activeStepInstances) {
      const code = step.stepDefinition.code;
      let record = stationMap.get(code);
      if (!record) {
        record = {
          stationType: (step.stepDefinition.stationType as StationType | null) ?? null,
          stepCode: code,
          stepName: step.stepDefinition.name,
          activeStepCount: 0,
          totalQtyIn: 0,
          totalQtyGood: 0,
          totalQtyDefect: 0,
          bundleCount: 0,
        };
        stationMap.set(code, record);
      }
      record.activeStepCount += 1;
      record.totalQtyIn += step.qtyIn ?? 0;
      record.totalQtyGood += step.qtyGood ?? 0;
      record.totalQtyDefect += step.qtyDefect ?? 0;
      record.bundleCount += step.currentBundles.length;
    }

    const wipByStation = Array.from(stationMap.values());

    return {
      ordersByStatus,
      wipByStation,
      totals: {
        totalOrders,
        activeOrders,
        completedOrders,
        waitingQcCount: waitingQcOrders.length,
        totalQtyGood: stepAggregates._sum.qtyGood ?? 0,
        totalQtyDefect: stepAggregates._sum.qtyDefect ?? 0,
        totalReworkCount: stepAggregates._sum.reworkCount ?? 0,
      },
      waitingQcOrders,
    };
  }
}
