import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { DashboardRepository } from './dashboard.repository.js';

describe('DashboardRepository (T5.5, FR-21)', () => {
  let repository: DashboardRepository;
  let prisma: {
    productionOrder: {
      groupBy: ReturnType<typeof vi.fn>;
    };
    stepInstance: {
      aggregate: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    prisma = {
      productionOrder: {
        groupBy: vi.fn(),
      },
      stepInstance: {
        aggregate: vi.fn(),
        findMany: vi.fn(),
      },
    };
    repository = new DashboardRepository(prisma as unknown as PrismaService);
  });

  it('aggregates orders by status, WIP by station, and QC waiting list correctly', async () => {
    prisma.productionOrder.groupBy.mockResolvedValue([
      { status: 'DRAFT', _count: { id: 3 } },
      { status: 'CONFIRMED', _count: { id: 2 } },
      { status: 'IN_PRODUCTION', _count: { id: 5 } },
      { status: 'COMPLETED', _count: { id: 4 } },
      { status: 'CANCELLED', _count: { id: 1 } },
    ]);

    prisma.stepInstance.aggregate.mockResolvedValue({
      _sum: {
        qtyGood: 1200,
        qtyDefect: 24,
        reworkCount: 3,
      },
    });

    const mockWaitingQcSteps = [
      {
        id: 'step-qc-1',
        startedAt: new Date('2026-10-18T10:00:00Z'),
        stepDefinition: {
          code: 'SEWING_QC',
          name: 'QC May ráp',
          stationType: 'QC',
        },
        instance: {
          order: {
            id: 'ord-1111-1111-1111-111111111111',
            orderNumber: 'ORD-2026-001',
            style: {
              styleCode: 'JN-SLIM-01',
            },
          },
        },
      },
    ];

    const mockActiveStepInstances = [
      {
        id: 'step-cut-1',
        qtyIn: 100,
        qtyGood: 98,
        qtyDefect: 2,
        stepDefinition: {
          code: 'CUTTING',
          name: 'Cắt vải',
          stationType: 'CUTTING',
          seq: 10,
        },
        currentBundles: [{ id: 'b1' }, { id: 'b2' }],
      },
      {
        id: 'step-sew-1',
        qtyIn: 98,
        qtyGood: 90,
        qtyDefect: 1,
        stepDefinition: {
          code: 'SEWING',
          name: 'May ráp',
          stationType: 'SEWING',
          seq: 20,
        },
        currentBundles: [{ id: 'b3' }],
      },
      {
        id: 'step-sew-2',
        qtyIn: 50,
        qtyGood: 48,
        qtyDefect: 2,
        stepDefinition: {
          code: 'SEWING',
          name: 'May ráp',
          stationType: 'SEWING',
          seq: 20,
        },
        currentBundles: [{ id: 'b4' }, { id: 'b5' }],
      },
    ];

    prisma.stepInstance.findMany
      .mockResolvedValueOnce(mockWaitingQcSteps)
      .mockResolvedValueOnce(mockActiveStepInstances);

    const result = await repository.getWipSummary();

    expect(result.ordersByStatus).toEqual({
      DRAFT: 3,
      CONFIRMED: 2,
      IN_PRODUCTION: 5,
      ON_HOLD: 0,
      COMPLETED: 4,
      CANCELLED: 1,
    });

    expect(result.totals).toEqual({
      totalOrders: 15,
      activeOrders: 7, // 2 CONFIRMED + 5 IN_PRODUCTION
      completedOrders: 4,
      waitingQcCount: 1,
      totalQtyGood: 1200,
      totalQtyDefect: 24,
      totalReworkCount: 3,
    });

    expect(result.waitingQcOrders).toHaveLength(1);
    expect(result.waitingQcOrders[0]).toEqual({
      orderId: 'ord-1111-1111-1111-111111111111',
      orderNumber: 'ORD-2026-001',
      styleCode: 'JN-SLIM-01',
      stepInstanceId: 'step-qc-1',
      stepCode: 'SEWING_QC',
      stepName: 'QC May ráp',
      stationType: 'QC',
      startedAt: '2026-10-18T10:00:00.000Z',
    });

    expect(result.wipByStation).toHaveLength(2);
    expect(result.wipByStation[0]).toEqual({
      stationType: 'CUTTING',
      stepCode: 'CUTTING',
      stepName: 'Cắt vải',
      activeStepCount: 1,
      totalQtyIn: 100,
      totalQtyGood: 98,
      totalQtyDefect: 2,
      bundleCount: 2,
    });
    expect(result.wipByStation[1]).toEqual({
      stationType: 'SEWING',
      stepCode: 'SEWING',
      stepName: 'May ráp',
      activeStepCount: 2,
      totalQtyIn: 148,
      totalQtyGood: 138,
      totalQtyDefect: 3,
      bundleCount: 3,
    });
  });

  it('handles empty database state gracefully with zeros', async () => {
    prisma.productionOrder.groupBy.mockResolvedValue([]);
    prisma.stepInstance.aggregate.mockResolvedValue({
      _sum: {
        qtyGood: null,
        qtyDefect: null,
        reworkCount: null,
      },
    });
    prisma.stepInstance.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await repository.getWipSummary();

    expect(result.totals.totalOrders).toBe(0);
    expect(result.totals.activeOrders).toBe(0);
    expect(result.totals.waitingQcCount).toBe(0);
    expect(result.totals.totalQtyGood).toBe(0);
    expect(result.totals.totalQtyDefect).toBe(0);
    expect(result.totals.totalReworkCount).toBe(0);
    expect(result.wipByStation).toEqual([]);
    expect(result.waitingQcOrders).toEqual([]);
  });
});
