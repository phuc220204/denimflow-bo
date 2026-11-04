import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  checkStepBalance,
  generateBundles,
  maxCutQty,
  negateEntry,
  previousQuantityStep as findPreviousQuantityStep,
  quantityIn,
  tracksQuantities,
  validateQuantityEntry,
  type QuantityCheckResult,
  type QuantityEntryContext,
} from '@denimflow/engine';
import type {
  RecordQuantityEntryDto,
  ReverseQuantityEntryDto,
  StepQuantityEntryDto,
  StepQuantityPanelDto,
} from '@denimflow/shared';
import { BusinessRuleViolation } from '../../common/errors/business-rule-violation.js';
import type { StepDefinition } from '../../generated/prisma/client.js';
import type { AuthResponse } from '../auth/auth.service.js';
import {
  ExecutionRepository,
  type QuantityEntry,
  type StepForQuantity,
  type Tx,
} from './execution.repository.js';
import { assertMayWork } from './step-access.js';

type CurrentUser = AuthResponse['user'];
type QuantityStep = StepForQuantity['instance']['stepInstances'][number];

const isCutting = (definition: Pick<StepDefinition, 'stationType'>) =>
  definition.stationType === 'CUTTING';

// The step whose good pieces this step takes in (engine rule, BR-14 / R-17 pass-through).
const previousQuantityStep = (step: StepForQuantity): QuantityStep | null =>
  findPreviousQuantityStep(step.instance.stepInstances, step.stepDefinition.seq);

// Pieces an entry took into its step. Stored rows are outsourced exactly when qty_sent is set,
// and reversal rows carry negated values, so plain sums give the net totals.
const entryIn = (entry: QuantityEntry) => quantityIn(entry, entry.qtySent !== null);

const sum = <T>(items: T[], value: (item: T) => number) =>
  items.reduce((total, item) => total + value(item), 0);

function assertValid(check: QuantityCheckResult): void {
  if (!check.valid) {
    throw new BusinessRuleViolation(
      check.ruleId ?? 'BR-08',
      check.reason ?? 'Số lượng không hợp lệ',
    );
  }
}

@Injectable()
export class QuantityService {
  constructor(
    @Inject(ExecutionRepository) private readonly executionRepository: ExecutionRepository,
  ) {}

  // FR-13: one entry per size at cutting (BR-07) or per bundle afterwards (BR-08), with
  // sent/received at outsourced stations (BR-09). Totals are read after locking the step rows.
  async recordQuantity(
    stepId: string,
    dto: RecordQuantityEntryDto,
    user: CurrentUser,
  ): Promise<StepQuantityEntryDto> {
    return this.executionRepository.runInTransaction(async (tx) => {
      const step = await this.loadQuantityStep(stepId, tx);
      const profile = await assertMayWork(this.executionRepository, tx, step.stepDefinition, user);
      const previous = previousQuantityStep(step);
      const { current, previousTotals } = await this.lockAndReload(tx, step, previous);
      this.assertInProgress(step, current.status);

      const isOutsourced = profile?.station?.isOutsourced ?? false;
      const entries = await this.executionRepository.findEntries(step.id, tx);
      const values = {
        qtyGood: dto.qtyGood,
        qtyDefect: dto.qtyDefect,
        qtySent: dto.qtySent ?? null,
        qtyReceived: dto.qtyReceived ?? null,
        mismatchReason: dto.mismatchReason ?? null,
      };

      let context: QuantityEntryContext;
      if (isCutting(step.stepDefinition)) {
        if (!dto.size) {
          throw new BadRequestException('Bước cắt nhập số lượng theo size');
        }
        const sizeLine = step.instance.order.sizeLines.find((line) => line.size === dto.size);
        if (!sizeLine) {
          throw new BadRequestException(`Đơn hàng không có size ${dto.size}`);
        }
        context = {
          isOutsourced,
          limit: {
            mode: 'CUTTING',
            size: sizeLine.size,
            plannedQty: sizeLine.plannedQty,
            tolerancePercent: Number(step.instance.order.style.cutTolerancePercent),
            cutSoFar: sum(
              entries.filter((entry) => entry.size === sizeLine.size),
              entryIn,
            ),
          },
        };
      } else {
        if (!dto.bundleId) {
          throw new BadRequestException('Các bước sau bước cắt nhập số lượng theo bó');
        }
        if (!previous || !previousTotals) {
          throw new ConflictException(
            `Bước ${step.stepDefinition.code} không có bước trước để nhận hàng`,
          );
        }
        const bundle = await this.executionRepository.findBundle(tx, dto.bundleId);
        if (!bundle || bundle.orderId !== step.instance.order.id) {
          throw new BadRequestException('Bó không thuộc đơn hàng này');
        }
        const availableFromPrevious = isCutting(previous.stepDefinition)
          ? bundle.qty
          : sum(
              (await this.executionRepository.findEntries(previous.id, tx)).filter(
                (entry) => entry.bundleId === bundle.id,
              ),
              (entry) => entry.qtyGood,
            );
        context = {
          isOutsourced,
          limit: {
            mode: 'HANDOVER',
            limits: [
              {
                label: `Bó ${bundle.bundleCode}`,
                available: availableFromPrevious,
                takenSoFar: sum(
                  entries.filter((entry) => entry.bundleId === bundle.id),
                  entryIn,
                ),
              },
              {
                label: `Bước ${step.stepDefinition.code}`,
                available: previousTotals.qtyGood ?? 0,
                takenSoFar: current.qtyIn ?? 0,
              },
            ],
          },
        };
      }

      assertValid(validateQuantityEntry(values, context));

      const entry = await this.executionRepository.createEntry(tx, {
        stepInstanceId: step.id,
        size: isCutting(step.stepDefinition) ? (dto.size ?? null) : null,
        bundleId: isCutting(step.stepDefinition) ? null : (dto.bundleId ?? null),
        ...values,
        note: dto.note ?? null,
        enteredBy: user.id,
      });
      await this.executionRepository.setStepQuantities(tx, step.id, {
        qtyIn: (current.qtyIn ?? 0) + quantityIn(values, isOutsourced),
        qtyGood: (current.qtyGood ?? 0) + values.qtyGood,
        qtyDefect: (current.qtyDefect ?? 0) + values.qtyDefect,
      });
      await this.executionRepository.recordAudit(tx, {
        entityType: 'StepQuantityEntry',
        entityId: entry.id,
        action: 'RECORD_QUANTITY',
        actorId: user.id,
        newValue: {
          stepInstanceId: step.id,
          size: entry.size,
          bundleId: entry.bundleId,
          ...values,
        },
      });

      return toEntryDto(entry);
    });
  }

  // R-22: entries are never edited; a reversal row cancels one entry with negated values.
  async reverseEntry(
    stepId: string,
    entryId: string,
    dto: ReverseQuantityEntryDto,
    user: CurrentUser,
  ): Promise<StepQuantityEntryDto> {
    return this.executionRepository.runInTransaction(async (tx) => {
      const step = await this.loadQuantityStep(stepId, tx);
      await assertMayWork(this.executionRepository, tx, step.stepDefinition, user);
      const { current } = await this.lockAndReload(tx, step, null);
      this.assertInProgress(step, current.status);

      const original = await this.executionRepository.findEntry(tx, entryId);
      if (!original || original.stepInstanceId !== step.id) {
        throw new NotFoundException('Không tìm thấy dòng nhập số lượng của bước này');
      }
      if (original.reversesEntryId) {
        throw new ConflictException('Không thể huỷ một dòng huỷ');
      }
      if (original.reversedBy) {
        throw new ConflictException('Dòng nhập này đã được huỷ');
      }

      const negated = negateEntry(original);
      const reversal = await this.executionRepository.createEntry(tx, {
        stepInstanceId: step.id,
        size: original.size,
        bundleId: original.bundleId,
        qtyGood: negated.qtyGood,
        qtyDefect: negated.qtyDefect,
        qtySent: negated.qtySent ?? null,
        qtyReceived: negated.qtyReceived ?? null,
        note: dto.reason,
        reversesEntryId: original.id,
        enteredBy: user.id,
      });
      await this.executionRepository.setStepQuantities(tx, step.id, {
        qtyIn: (current.qtyIn ?? 0) - entryIn(original),
        qtyGood: (current.qtyGood ?? 0) - original.qtyGood,
        qtyDefect: (current.qtyDefect ?? 0) - original.qtyDefect,
      });
      await this.executionRepository.recordAudit(tx, {
        entityType: 'StepQuantityEntry',
        entityId: reversal.id,
        action: 'REVERSE_QUANTITY',
        actorId: user.id,
        oldValue: {
          entryId: original.id,
          qtyGood: original.qtyGood,
          qtyDefect: original.qtyDefect,
        },
        newValue: { reason: dto.reason },
      });

      return toEntryDto(reversal);
    });
  }

  async getQuantityPanel(stepId: string, user: CurrentUser): Promise<StepQuantityPanelDto> {
    const step = await this.loadQuantityStep(stepId);
    const previous = previousQuantityStep(step);
    const [entries, profile] = await Promise.all([
      this.executionRepository.findEntries(step.id),
      this.executionRepository.findProfileWithStation(user.id),
    ]);
    const cutting = isCutting(step.stepDefinition);
    const order = step.instance.order;

    const sizes = cutting
      ? order.sizeLines.map((line) => ({
          size: line.size,
          plannedQty: line.plannedQty,
          maxQty: maxCutQty(line.plannedQty, Number(order.style.cutTolerancePercent)),
          cutQty: sum(
            entries.filter((entry) => entry.size === line.size),
            entryIn,
          ),
        }))
      : [];

    let bundles: StepQuantityPanelDto['bundles'] = [];
    if (!cutting && previous) {
      const [orderBundles, previousEntries] = await Promise.all([
        this.executionRepository.findBundles(order.id),
        isCutting(previous.stepDefinition)
          ? Promise.resolve([])
          : this.executionRepository.findEntries(previous.id),
      ]);
      bundles = orderBundles.map((bundle) => ({
        id: bundle.id,
        bundleCode: bundle.bundleCode,
        size: bundle.size,
        availableQty: isCutting(previous.stepDefinition)
          ? bundle.qty
          : sum(
              previousEntries.filter((entry) => entry.bundleId === bundle.id),
              (entry) => entry.qtyGood,
            ),
        takenQty: sum(
          entries.filter((entry) => entry.bundleId === bundle.id),
          entryIn,
        ),
      }));
    }

    return {
      stepId: step.id,
      stepCode: step.stepDefinition.code,
      status: step.status,
      mode: cutting ? 'CUTTING' : 'BUNDLE',
      isOutsourced:
        user.role === 'STATION_OPERATOR' &&
        profile?.station?.stationType === step.stepDefinition.stationType
          ? profile.station.isOutsourced
          : false,
      qtyIn: step.qtyIn ?? 0,
      qtyGood: step.qtyGood ?? 0,
      qtyDefect: step.qtyDefect ?? 0,
      previousGood: cutting ? null : (previous?.qtyGood ?? 0),
      sizes,
      bundles,
      entries: entries.map(toEntryDto),
    };
  }

  // Called by ExecutionService.completeStep inside its transaction, before the status changes.
  // Cutting must have counted something and creates the bundles from the good pieces per size
  // (FR-15, R-20); later steps must account for everything handed over (BR-08).
  async closeOnComplete(tx: Tx, stepId: string, actorId: string): Promise<void> {
    const step = await this.executionRepository.findStepForQuantity(stepId, tx);
    if (!step || !tracksQuantities(step.stepDefinition)) {
      return;
    }
    const previous = previousQuantityStep(step);
    const { current, previousTotals } = await this.lockAndReload(tx, step, previous);

    if (!isCutting(step.stepDefinition)) {
      assertValid(checkStepBalance(current.qtyIn ?? 0, previousTotals?.qtyGood ?? 0));
      return;
    }

    if ((current.qtyIn ?? 0) <= 0) {
      throw new ConflictException('Bước cắt phải nhập số lượng trước khi hoàn thành');
    }
    const entries = await this.executionRepository.findEntries(step.id, tx);
    const order = step.instance.order;
    const bundles = generateBundles(
      order.orderNumber,
      order.sizeLines.map((line) => ({
        size: line.size,
        qty: sum(
          entries.filter((entry) => entry.size === line.size),
          (entry) => entry.qtyGood,
        ),
      })),
    );
    await this.executionRepository.createBundles(tx, order.id, bundles);
    await this.executionRepository.recordAudit(tx, {
      entityType: 'ProductionOrder',
      entityId: order.id,
      action: 'GENERATE_BUNDLES',
      actorId,
      newValue: { stepInstanceId: step.id, bundleCodes: bundles.map((b) => b.bundleCode) },
    });
  }

  private async loadQuantityStep(stepId: string, tx?: Tx): Promise<StepForQuantity> {
    const step = await this.executionRepository.findStepForQuantity(stepId, tx);
    if (!step) {
      throw new NotFoundException('Không tìm thấy bước sản xuất');
    }
    if (!tracksQuantities(step.stepDefinition)) {
      throw new BadRequestException(`Bước ${step.stepDefinition.code} không nhập số lượng`);
    }
    return step;
  }

  private async lockAndReload(tx: Tx, step: StepForQuantity, previous: QuantityStep | null) {
    const ids = previous ? [step.id, previous.id] : [step.id];
    await this.executionRepository.lockSteps(tx, ids);
    const rows = await this.executionRepository.findStepsByIds(tx, ids);
    const current = rows.find((row) => row.id === step.id);
    if (!current) {
      throw new NotFoundException('Không tìm thấy bước sản xuất');
    }
    return { current, previousTotals: rows.find((row) => row.id === previous?.id) ?? null };
  }

  private assertInProgress(step: StepForQuantity, status: string): void {
    if (status !== 'IN_PROGRESS') {
      throw new ConflictException(
        `Bước ${step.stepDefinition.code} đang ở trạng thái ${status}, chỉ nhập số lượng khi IN_PROGRESS`,
      );
    }
  }
}

function toEntryDto(entry: QuantityEntry): StepQuantityEntryDto {
  return {
    id: entry.id,
    stepInstanceId: entry.stepInstanceId,
    bundleId: entry.bundleId,
    bundleCode: entry.bundle?.bundleCode ?? null,
    size: entry.size,
    qtyGood: entry.qtyGood,
    qtyDefect: entry.qtyDefect,
    qtySent: entry.qtySent,
    qtyReceived: entry.qtyReceived,
    mismatchReason: entry.mismatchReason,
    note: entry.note,
    reversesEntryId: entry.reversesEntryId,
    isReversed: entry.reversedBy !== null,
    enteredBy: entry.enteredBy,
    enteredAt: entry.enteredAt.toISOString(),
  };
}
