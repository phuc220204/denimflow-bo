// Workflow engine: pure TypeScript, no framework, database or I/O imports
// (see .agents/rules/01-architecture-boundaries.md).
// Quantity rules for FR-13 and FR-15: BR-07 (cut tolerance), BR-08 (conservation),
// BR-09 (outsourced sent/received) and bundle generation at cutting.

// Pieces per bundle (BUSINESS_RECONCILIATION R-20, owner decision 2026-10-19).
export const BUNDLE_SIZE = 50;

export interface QuantityEntryValues {
  qtyGood: number;
  qtyDefect: number;
  qtySent?: number | null;
  qtyReceived?: number | null;
  mismatchReason?: string | null;
}

export interface QuantityCheckResult {
  valid: boolean;
  ruleId?: 'BR-07' | 'BR-08' | 'BR-09';
  reason?: string;
}

// Cutting is counted per size against the plan (BR-07).
export interface CuttingLimit {
  mode: 'CUTTING';
  size: string;
  plannedQty: number;
  tolerancePercent: number;
  cutSoFar: number;
}

// Later steps take pieces handed over by the previous step (BR-08), checked per bundle and per step.
export interface HandoverLimit {
  mode: 'HANDOVER';
  limits: Array<{ label: string; available: number; takenSoFar: number }>;
}

export interface QuantityEntryContext {
  isOutsourced: boolean;
  limit: CuttingLimit | HandoverLimit;
}

const OK: QuantityCheckResult = { valid: true };

// BR-07: plan + tolerance, rounded down. Tolerance has two decimals (numeric(5,2)), so integer
// hundredths keep the arithmetic exact.
export function maxCutQty(plannedQty: number, tolerancePercent: number): number {
  const toleranceHundredths = Math.round(tolerancePercent * 100);
  return Math.floor((plannedQty * (10000 + toleranceHundredths)) / 10000);
}

// Pieces an entry takes into its step: what was sent out for outsourced work, else good + defect.
export function quantityIn(entry: QuantityEntryValues, isOutsourced: boolean): number {
  return isOutsourced ? (entry.qtySent ?? 0) : entry.qtyGood + entry.qtyDefect;
}

function checkOutsourced(entry: QuantityEntryValues, isOutsourced: boolean): QuantityCheckResult {
  const hasSent = entry.qtySent !== undefined && entry.qtySent !== null;
  const hasReceived = entry.qtyReceived !== undefined && entry.qtyReceived !== null;

  if (!isOutsourced) {
    return hasSent || hasReceived
      ? {
          valid: false,
          ruleId: 'BR-09',
          reason: 'BR-09: Trạm nội bộ không nhập số gửi/nhận gia công ngoài.',
        }
      : OK;
  }

  if (!hasSent || !hasReceived) {
    return {
      valid: false,
      ruleId: 'BR-09',
      reason: 'BR-09: Trạm gia công ngoài phải nhập cả số gửi đi và số nhận về.',
    };
  }
  const sent = entry.qtySent!;
  const received = entry.qtyReceived!;
  if (received > sent) {
    return {
      valid: false,
      ruleId: 'BR-09',
      reason: `BR-09: Số nhận về (${received}) không được lớn hơn số gửi đi (${sent}).`,
    };
  }
  if (entry.qtyGood + entry.qtyDefect !== received) {
    return {
      valid: false,
      ruleId: 'BR-09',
      reason: `BR-09: Số đạt + số lỗi (${entry.qtyGood + entry.qtyDefect}) phải bằng số nhận về (${received}).`,
    };
  }
  if (sent !== received && !entry.mismatchReason?.trim()) {
    return {
      valid: false,
      ruleId: 'BR-09',
      reason: `BR-09: Gửi ${sent} nhưng nhận ${received}, phải ghi lý do chênh lệch.`,
    };
  }
  return OK;
}

/**
 * Validates one new quantity entry. The caller must pass totals read after locking the step rows,
 * so two parallel entries cannot jointly exceed a limit (DATABASE_DESIGN.md §7.2).
 */
export function validateQuantityEntry(
  entry: QuantityEntryValues,
  context: QuantityEntryContext,
): QuantityCheckResult {
  const outsourced = checkOutsourced(entry, context.isOutsourced);
  if (!outsourced.valid) {
    return outsourced;
  }

  const taken = quantityIn(entry, context.isOutsourced);
  const { limit } = context;

  if (limit.mode === 'CUTTING') {
    const max = maxCutQty(limit.plannedQty, limit.tolerancePercent);
    const total = limit.cutSoFar + taken;
    if (total > max) {
      return {
        valid: false,
        ruleId: 'BR-07',
        reason: `BR-07: Size ${limit.size} cắt tổng ${total}, vượt kế hoạch ${limit.plannedQty} + ${limit.tolerancePercent}% (tối đa ${max}).`,
      };
    }
    return OK;
  }

  // BR-08: good AND defect pieces both come out of what the previous step handed over.
  for (const { label, available, takenSoFar } of limit.limits) {
    if (takenSoFar + taken > available) {
      return {
        valid: false,
        ruleId: 'BR-08',
        reason: `BR-08: ${label} chỉ còn ${Math.max(available - takenSoFar, 0)} sản phẩm từ bước trước, không nhận thêm ${taken} được.`,
      };
    }
  }
  return OK;
}

/**
 * BR-08, second half: before a step completes, everything the previous step handed over must be
 * accounted for as good, defect, or (outsourced) recorded loss.
 */
export function checkStepBalance(qtyIn: number, previousGood: number): QuantityCheckResult {
  if (qtyIn !== previousGood) {
    return {
      valid: false,
      ruleId: 'BR-08',
      reason: `BR-08: Bước này đã nhận ${qtyIn}/${previousGood} sản phẩm đạt của bước trước. Hãy nhập đủ (cả hàng lỗi) trước khi hoàn thành.`,
    };
  }
  return OK;
}

// A reversal (compensating entry) carries the exact negation of the entry it cancels (R-22).
export function negateEntry(entry: QuantityEntryValues): QuantityEntryValues {
  const negate = (value: number | null | undefined) =>
    value === null || value === undefined ? null : -value;
  return {
    qtyGood: -entry.qtyGood,
    qtyDefect: -entry.qtyDefect,
    qtySent: negate(entry.qtySent),
    qtyReceived: negate(entry.qtyReceived),
    mismatchReason: null,
  };
}

export interface GeneratedBundle {
  bundleCode: string;
  size: string;
  qty: number;
}

/**
 * FR-15: splits the good pieces cut per size into bundles of `bundleSize`.
 * Codes run across sizes: `${orderNumber}-B001`, `-B002`, ...
 */
export function generateBundles(
  orderNumber: string,
  goodBySize: Array<{ size: string; qty: number }>,
  bundleSize = BUNDLE_SIZE,
): GeneratedBundle[] {
  const bundles: GeneratedBundle[] = [];
  for (const { size, qty } of goodBySize) {
    for (let remaining = qty; remaining > 0; remaining -= bundleSize) {
      bundles.push({
        bundleCode: `${orderNumber}-B${String(bundles.length + 1).padStart(3, '0')}`,
        size,
        qty: Math.min(remaining, bundleSize),
      });
    }
  }
  return bundles;
}
