// Workflow engine: pure TypeScript, no framework, database or I/O imports
// (see .agents/rules/01-architecture-boundaries.md).
// Quantity validation and Bundle generation (T4.3, FR-13, FR-15, BR-07, BR-08, BR-09).

export interface QuantityValidationInput {
  stepCode: string;
  isCutting: boolean;
  plannedQtyForSize?: number;
  cutTolerancePercent?: number; // default 5%
  existingCutQtyForSize?: number;
  entryQtyGood: number;
  entryQtyDefect?: number;
  previousStepGoodQty?: number;
  currentStepTotalGoodSoFar?: number;
  // Outsourced steps (BR-09)
  isOutsourced?: boolean;
  qtySent?: number;
  qtyReceived?: number;
  mismatchReason?: string;
}

export interface QuantityValidationResult {
  valid: boolean;
  ruleId?: 'BR-07' | 'BR-08' | 'BR-09';
  reason?: string;
}

/**
 * Validates a quantity entry against BR-07 (cut tolerance), BR-08 (conservation), and BR-09 (outsourced reconciliation).
 */
export function validateQuantityEntry(input: QuantityValidationInput): QuantityValidationResult {
  const {
    isCutting,
    plannedQtyForSize,
    cutTolerancePercent = 5,
    existingCutQtyForSize = 0,
    entryQtyGood,
    entryQtyDefect = 0,
    previousStepGoodQty,
    currentStepTotalGoodSoFar = 0,
    isOutsourced,
    qtySent,
    qtyReceived,
    mismatchReason,
  } = input;

  const totalEntry = entryQtyGood + entryQtyDefect;

  // BR-07: Total cut quantity per size may not exceed plan + configured tolerance
  if (isCutting && plannedQtyForSize !== undefined) {
    const maxAllowedCut = Math.floor(plannedQtyForSize * (1 + cutTolerancePercent / 100));
    const newTotalForSize = existingCutQtyForSize + totalEntry;
    if (newTotalForSize > maxAllowedCut) {
      return {
        valid: false,
        ruleId: 'BR-07',
        reason: `BR-07: Cut quantity (${newTotalForSize}) exceeds planned quantity (${plannedQtyForSize}) plus ${cutTolerancePercent}% tolerance (max allowed: ${maxAllowedCut}).`,
      };
    }
  }

  // BR-08: Quantity conservation: quantity entering step <= good quantity of previous step
  if (!isCutting && previousStepGoodQty !== undefined) {
    const newTotalGood = currentStepTotalGoodSoFar + totalEntry;
    if (newTotalGood > previousStepGoodQty) {
      return {
        valid: false,
        ruleId: 'BR-08',
        reason: `BR-08: Total quantity (${newTotalGood}) exceeds previous step's good quantity (${previousStepGoodQty}).`,
      };
    }
  }

  // BR-09: Outsourced wash/dye reconciliation
  if (isOutsourced && qtySent !== undefined && qtyReceived !== undefined) {
    if (qtySent !== qtyReceived && (!mismatchReason || mismatchReason.trim() === '')) {
      return {
        valid: false,
        ruleId: 'BR-09',
        reason: `BR-09: Outsourced step quantity mismatch (sent: ${qtySent}, received: ${qtyReceived}) requires a recorded reason.`,
      };
    }
  }

  return { valid: true };
}

export interface SizeQuantityPlan {
  size: string;
  plannedQty: number;
}

export interface GeneratedBundle {
  bundleCode: string;
  size: string;
  qty: number;
}

/**
 * Generates bundles for cutting (FR-15).
 * Bundle codes follow format: `${orderNumber}-B${index.toString().padStart(3, '0')}`.
 * Standard bundle size default is 50 pieces per bundle, or single bundle if <= 50.
 */
export function generateBundlesForCutting(
  orderNumber: string,
  sizePlans: SizeQuantityPlan[],
  bundleSize = 50,
): GeneratedBundle[] {
  const bundles: GeneratedBundle[] = [];
  let bundleIndex = 1;

  for (const plan of sizePlans) {
    let remaining = plan.plannedQty;
    while (remaining > 0) {
      const qtyInBundle = Math.min(remaining, bundleSize);
      bundles.push({
        bundleCode: `${orderNumber}-B${bundleIndex.toString().padStart(3, '0')}`,
        size: plan.size,
        qty: qtyInBundle,
      });
      remaining -= qtyInBundle;
      bundleIndex++;
    }
  }

  return bundles;
}
