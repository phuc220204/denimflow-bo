import { describe, expect, it, vi } from 'vitest';
import type { DashboardRepository, OpenStep, StepTotals } from './dashboard.repository.js';
import { DashboardService } from './dashboard.service.js';

type Definition = {
  code: string;
  seq: number;
  stepType?: string;
  responsibleRole?: string;
  stationType?: string | null;
};

const CUTTING: Definition = { code: 'CUTTING', seq: 6, stationType: 'CUTTING' };
const SEWING: Definition = { code: 'SEWING', seq: 8, stationType: 'SEWING' };
const DYEING: Definition = { code: 'DYEING', seq: 9, stationType: 'DYEING' };
const EFFECT_WASH: Definition = { code: 'EFFECT_WASH', seq: 10, stationType: 'WASH' };
const FINISHING: Definition = { code: 'FINISHING', seq: 12, stationType: 'FINISHING' };
const FINAL_QC: Definition = {
  code: 'FINAL_QC',
  seq: 13,
  stepType: 'QC',
  responsibleRole: 'QC_INSPECTOR',
  stationType: 'QC',
};

const full = (d: Definition) => ({
  code: d.code,
  name: `Step ${d.code}`,
  seq: d.seq,
  stepType: d.stepType ?? 'PRODUCTION',
  responsibleRole: d.responsibleRole ?? 'STATION_OPERATOR',
  stationType: d.stationType ?? null,
});

// One open step of an order, with the order's other steps as [definition, status, id].
function openStep(
  orderId: string,
  definition: Definition,
  status: string,
  siblings: Array<[Definition, string, string]>,
  extra: { qtyIn?: number; startedAt?: Date } = {},
): OpenStep {
  const id = `${orderId}-${definition.code}`;
  return {
    id,
    status,
    startedAt: extra.startedAt ?? null,
    qtyIn: extra.qtyIn ?? null,
    stepDefinition: full(definition),
    instance: {
      orderId,
      order: { orderNumber: `PO-${orderId}`, style: { styleCode: 'JN-SLIM-01' } },
      stepInstances: [
        { id, status, stepDefinition: full(definition) },
        ...siblings.map(([d, s, siblingId]) => ({
          id: siblingId,
          status: s,
          stepDefinition: full(d),
        })),
      ],
    },
  } as unknown as OpenStep;
}

function serviceWith(data: {
  orderCounts?: Array<{ status: string; count: number }>;
  totals?: StepTotals[];
  definitions?: Array<Definition & { id: string }>;
  openSteps?: OpenStep[];
  bundles?: Array<{ id: string; orderId: string; qty: number }>;
  good?: Array<{ stepInstanceId: string; bundleId: string; qtyGood: number }>;
}) {
  const repository = {
    countOrdersByStatus: vi.fn().mockResolvedValue(data.orderCounts ?? []),
    sumQuantitiesByStepDefinition: vi.fn().mockResolvedValue(data.totals ?? []),
    findStepDefinitions: vi
      .fn()
      .mockResolvedValue((data.definitions ?? []).map((d) => ({ id: d.id, ...full(d) }))),
    findOpenSteps: vi.fn().mockResolvedValue(data.openSteps ?? []),
    findBundles: vi.fn().mockResolvedValue(data.bundles ?? []),
    sumGoodByStepAndBundle: vi.fn().mockResolvedValue(data.good ?? []),
  };
  return {
    repository,
    service: new DashboardService(repository as unknown as DashboardRepository),
  };
}

const row = (summary: Awaited<ReturnType<DashboardService['getWipSummary']>>, code: string) =>
  summary.steps.find((step) => step.stepCode === code);

describe('DashboardService.getWipSummary (FR-21)', () => {
  it('R-26: bundles handed over by cutting count at their full quantity', async () => {
    const { service, repository } = serviceWith({
      openSteps: [openStep('a', SEWING, 'IN_PROGRESS', [[CUTTING, 'DONE', 'a-cut']])],
      bundles: [
        { id: 'a1', orderId: 'a', qty: 50 },
        { id: 'a2', orderId: 'a', qty: 48 },
      ],
    });

    const summary = await service.getWipSummary();

    expect(repository.findOpenSteps).toHaveBeenCalledWith([
      'READY',
      'IN_PROGRESS',
      'WAITING_QC',
      'REWORK',
    ]);
    expect(repository.findBundles).toHaveBeenCalledWith(['a']);
    expect(repository.sumGoodByStepAndBundle).toHaveBeenCalledWith([]);
    expect(row(summary, 'SEWING')).toMatchObject({
      openOrderCount: 1,
      wipBundleCount: 2,
      wipQty: 98,
    });
    expect(summary.totals).toMatchObject({ wipBundleCount: 2, wipQty: 98 });
  });

  it('R-26: later steps take the net good pieces of the step before, skipped steps passed through', async () => {
    const { service, repository } = serviceWith({
      openSteps: [
        openStep('b', EFFECT_WASH, 'READY', [
          [CUTTING, 'DONE', 'b-cut'],
          [SEWING, 'DONE', 'b-sew'],
          [DYEING, 'SKIPPED', 'b-dye'],
        ]),
      ],
      bundles: [
        { id: 'b1', orderId: 'b', qty: 50 },
        { id: 'b2', orderId: 'b', qty: 50 },
        { id: 'b3', orderId: 'b', qty: 50 },
      ],
      // b1 net after a reversal row; b2 ended with only defects; b3 has no entry at all.
      good: [
        { stepInstanceId: 'b-sew', bundleId: 'b1', qtyGood: 45 },
        { stepInstanceId: 'b-sew', bundleId: 'b2', qtyGood: 0 },
      ],
    });

    const summary = await service.getWipSummary();

    expect(repository.sumGoodByStepAndBundle).toHaveBeenCalledWith(['b-sew']);
    expect(row(summary, 'EFFECT_WASH')).toMatchObject({ wipBundleCount: 1, wipQty: 45 });
  });

  it('R-26: an open cutting step counts the pieces cut so far, without bundles', async () => {
    const { service, repository } = serviceWith({
      openSteps: [openStep('c', CUTTING, 'IN_PROGRESS', [], { qtyIn: 60 })],
    });

    const summary = await service.getWipSummary();

    expect(repository.findBundles).toHaveBeenCalledWith([]);
    expect(row(summary, 'CUTTING')).toMatchObject({
      openOrderCount: 1,
      wipBundleCount: 0,
      wipQty: 60,
      tracksQuantities: true,
    });
  });

  it('R-26: steps waiting for a QC decision are listed and the KPI counts orders', async () => {
    const startedAt = new Date('2026-10-19T08:00:00.000Z');
    const { service } = serviceWith({
      openSteps: [
        openStep('d', SEWING, 'WAITING_QC', [[CUTTING, 'DONE', 'd-cut']], { startedAt }),
        openStep('e', FINAL_QC, 'READY', [[FINISHING, 'DONE', 'e-fin']]),
        openStep('f', FINISHING, 'IN_PROGRESS', [[SEWING, 'DONE', 'f-sew']]),
      ],
      bundles: [{ id: 'e1', orderId: 'e', qty: 50 }],
      good: [{ stepInstanceId: 'e-fin', bundleId: 'e1', qtyGood: 49 }],
    });

    const summary = await service.getWipSummary();

    expect(summary.waitingQc).toEqual([
      expect.objectContaining({
        orderNumber: 'PO-d',
        stepCode: 'SEWING',
        status: 'WAITING_QC',
        startedAt: startedAt.toISOString(),
      }),
      expect.objectContaining({ orderNumber: 'PO-e', stepCode: 'FINAL_QC', status: 'READY' }),
    ]);
    expect(summary.totals.waitingQcOrderCount).toBe(2);
    // Bundles wait at the QC step too; it has no quantities of its own.
    expect(row(summary, 'FINAL_QC')).toMatchObject({
      wipBundleCount: 1,
      wipQty: 49,
      tracksQuantities: false,
    });
  });

  it('FR-21: orders by status, totals per step code across versions, idle steps hidden', async () => {
    const { service } = serviceWith({
      orderCounts: [
        { status: 'DRAFT', count: 2 },
        { status: 'IN_PRODUCTION', count: 3 },
        { status: 'COMPLETED', count: 1 },
      ],
      definitions: [
        { id: 'cut-v1', ...CUTTING },
        { id: 'cut-v2', ...CUTTING },
        { id: 'sew-v1', ...SEWING },
        { id: 'fin-v1', ...FINISHING },
      ],
      totals: [
        { stepDefinitionId: 'cut-v1', qtyIn: 100, qtyGood: 98, qtyDefect: 2, reworkCount: 0 },
        { stepDefinitionId: 'cut-v2', qtyIn: 50, qtyGood: 50, qtyDefect: 0, reworkCount: 0 },
        { stepDefinitionId: 'sew-v1', qtyIn: 98, qtyGood: 90, qtyDefect: 8, reworkCount: 1 },
        { stepDefinitionId: 'fin-v1', qtyIn: 0, qtyGood: 0, qtyDefect: 0, reworkCount: 0 },
      ],
    });

    const summary = await service.getWipSummary();

    expect(summary.ordersByStatus).toEqual({
      DRAFT: 2,
      CONFIRMED: 0,
      IN_PRODUCTION: 3,
      ON_HOLD: 0,
      COMPLETED: 1,
      CANCELLED: 0,
    });
    expect(summary.totals).toMatchObject({
      totalOrders: 6,
      activeOrders: 3,
      completedOrders: 1,
      totalQtyDefect: 10,
      totalReworkCount: 1,
      waitingQcOrderCount: 0,
    });
    expect(summary.steps.map((s) => [s.stepCode, s.qtyIn, s.qtyGood, s.qtyDefect])).toEqual([
      ['CUTTING', 150, 148, 2],
      ['SEWING', 98, 90, 8],
    ]);
  });
});
