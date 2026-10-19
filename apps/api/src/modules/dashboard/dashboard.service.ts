import { Inject, Injectable } from '@nestjs/common';
import { previousQuantityStep, tracksQuantities } from '@denimflow/engine';
import {
  type DashboardStepRowDto,
  type DashboardWaitingQcItemDto,
  type DashboardWipSummaryDto,
  type OrderStatus,
  orderStatusSchema,
  type StationType,
  type StepStatus,
} from '@denimflow/shared';
import { DashboardRepository, type OpenStep } from './dashboard.repository.js';

// R-26: a step is open when it is on someone's desk (READY, IN_PROGRESS, REWORK) or waiting for
// its QC decision (WAITING_QC); PENDING has not started, DONE and SKIPPED are behind the order.
const OPEN_STATUSES: StepStatus[] = ['READY', 'IN_PROGRESS', 'WAITING_QC', 'REWORK'];
// For a QC-type step the inspection is the completion (R-06), so it waits until it is DONE.
const QC_STEP_UNDECIDED: StepStatus[] = ['READY', 'IN_PROGRESS'];

type Bundle = { id: string; orderId: string; qty: number };

const isCutting = (definition: { stationType: string | null }) =>
  definition.stationType === 'CUTTING';

const sum = <T>(items: T[], value: (item: T) => number) =>
  items.reduce((total, item) => total + value(item), 0);

@Injectable()
export class DashboardService {
  constructor(
    @Inject(DashboardRepository) private readonly dashboardRepository: DashboardRepository,
  ) {}

  // FR-21: orders by status, WIP per step, good/defect/rework totals, orders waiting for QC.
  async getWipSummary(): Promise<DashboardWipSummaryDto> {
    const [orderCounts, stepTotals, openSteps] = await Promise.all([
      this.dashboardRepository.countOrdersByStatus(),
      this.dashboardRepository.sumQuantitiesByStepDefinition(),
      this.dashboardRepository.findOpenSteps(OPEN_STATUSES),
    ]);

    // Open steps after cutting hold bundles; the step before them says how many pieces each has.
    const handedOver = openSteps.flatMap((step) => {
      const previous = previousQuantityStep(step.instance.stepInstances, step.stepDefinition.seq);
      return previous ? [{ step, previous }] : [];
    });
    const [definitions, bundles, goodByStepAndBundle] = await Promise.all([
      this.dashboardRepository.findStepDefinitions(stepTotals.map((t) => t.stepDefinitionId)),
      this.dashboardRepository.findBundles([
        ...new Set(handedOver.map(({ step }) => step.instance.orderId)),
      ]),
      this.dashboardRepository.sumGoodByStepAndBundle([
        ...new Set(
          handedOver
            .filter(({ previous }) => !isCutting(previous.stepDefinition))
            .map(({ previous }) => previous.id),
        ),
      ]),
    ]);

    const bundlesByOrder = new Map<string, Bundle[]>();
    for (const bundle of bundles) {
      bundlesByOrder.set(bundle.orderId, [...(bundlesByOrder.get(bundle.orderId) ?? []), bundle]);
    }
    const goodOf = new Map(
      goodByStepAndBundle.map((row) => [`${row.stepInstanceId}:${row.bundleId}`, row.qtyGood]),
    );
    const previousOf = new Map(handedOver.map(({ step, previous }) => [step.id, previous]));

    // Rows per step code, in template order, with the totals of every order.
    const totalsOf = new Map(stepTotals.map((totals) => [totals.stepDefinitionId, totals]));
    const rows = new Map<string, DashboardStepRowDto>();
    for (const definition of definitions) {
      const row = rows.get(definition.code) ?? emptyRow(definition);
      const totals = totalsOf.get(definition.id);
      row.qtyIn += totals?.qtyIn ?? 0;
      row.qtyGood += totals?.qtyGood ?? 0;
      row.qtyDefect += totals?.qtyDefect ?? 0;
      row.reworkCount += totals?.reworkCount ?? 0;
      rows.set(definition.code, row);
    }

    for (const step of openSteps) {
      const row = rows.get(step.stepDefinition.code) ?? emptyRow(step.stepDefinition);
      row.openOrderCount += 1;
      const wip = this.wipAt(step, previousOf.get(step.id) ?? null, bundlesByOrder, goodOf);
      row.wipBundleCount += wip.bundleCount;
      row.wipQty += wip.qty;
      rows.set(step.stepDefinition.code, row);
    }

    const steps = [...rows.values()]
      .filter(
        (row) =>
          row.openOrderCount > 0 ||
          row.qtyIn > 0 ||
          row.qtyGood > 0 ||
          row.qtyDefect > 0 ||
          row.reworkCount > 0,
      )
      .sort((a, b) => a.seq - b.seq || a.stepCode.localeCompare(b.stepCode));

    const waitingQc = openSteps
      .filter(
        (step) =>
          step.status === 'WAITING_QC' ||
          (step.stepDefinition.stepType === 'QC' && QC_STEP_UNDECIDED.includes(step.status)),
      )
      .map(toWaitingQcItem);

    const ordersByStatus = Object.fromEntries(
      orderStatusSchema.options.map((status) => [status, 0]),
    ) as Record<OrderStatus, number>;
    for (const { status, count } of orderCounts) {
      ordersByStatus[status as OrderStatus] = count;
    }

    return {
      ordersByStatus,
      totals: {
        totalOrders: sum(orderCounts, (row) => row.count),
        activeOrders: ordersByStatus.CONFIRMED + ordersByStatus.IN_PRODUCTION,
        completedOrders: ordersByStatus.COMPLETED,
        wipBundleCount: sum(steps, (row) => row.wipBundleCount),
        wipQty: sum(steps, (row) => row.wipQty),
        // A defective piece is not handed on (BR-08), so summing over steps counts it once.
        totalQtyDefect: sum(stepTotals, (totals) => totals.qtyDefect),
        totalReworkCount: sum(stepTotals, (totals) => totals.reworkCount),
        waitingQcOrderCount: new Set(waitingQc.map((item) => item.orderId)).size,
      },
      steps,
      waitingQc,
    };
  }

  // R-26: bundles stay at an open step until it is DONE, because the next step opens only then
  // (BR-14). A bundle is at the step when the step before handed over good pieces of it: the
  // bundle quantity after cutting (R-20), else its net good pieces at that step.
  private wipAt(
    step: OpenStep,
    previous: OpenStep['instance']['stepInstances'][number] | null,
    bundlesByOrder: Map<string, Bundle[]>,
    goodOf: Map<string, number>,
  ): { bundleCount: number; qty: number } {
    if (tracksQuantities(step.stepDefinition) && isCutting(step.stepDefinition)) {
      // Bundles are created when cutting completes; until then count the pieces cut so far.
      return { bundleCount: 0, qty: step.qtyIn ?? 0 };
    }
    if (!previous) {
      return { bundleCount: 0, qty: 0 };
    }
    const available = (bundles: Bundle[]) =>
      bundles
        .map((bundle) =>
          isCutting(previous.stepDefinition)
            ? bundle.qty
            : (goodOf.get(`${previous.id}:${bundle.id}`) ?? 0),
        )
        .filter((qty) => qty > 0);
    const handed = available(bundlesByOrder.get(step.instance.orderId) ?? []);
    return { bundleCount: handed.length, qty: sum(handed, (qty) => qty) };
  }
}

function emptyRow(definition: {
  code: string;
  name: string;
  seq: number;
  responsibleRole: string;
  stationType: string | null;
}): DashboardStepRowDto {
  return {
    stepCode: definition.code,
    stepName: definition.name,
    seq: definition.seq,
    stationType: definition.stationType as StationType | null,
    tracksQuantities: tracksQuantities(definition),
    openOrderCount: 0,
    wipBundleCount: 0,
    wipQty: 0,
    qtyIn: 0,
    qtyGood: 0,
    qtyDefect: 0,
    reworkCount: 0,
  };
}

function toWaitingQcItem(step: OpenStep): DashboardWaitingQcItemDto {
  return {
    orderId: step.instance.orderId,
    orderNumber: step.instance.order.orderNumber,
    styleCode: step.instance.order.style.styleCode,
    stepInstanceId: step.id,
    stepCode: step.stepDefinition.code,
    stepName: step.stepDefinition.name,
    stationType: step.stepDefinition.stationType as StationType | null,
    status: step.status,
    startedAt: step.startedAt?.toISOString() ?? null,
  };
}
