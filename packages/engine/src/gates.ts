// Workflow engine: pure TypeScript, no framework, database or I/O imports
// (see .agents/rules/01-architecture-boundaries.md).
// Evaluates workflow Gate checks (BR-06, BR-14, BR-15).

export interface FabricBomLineAllocation {
  requiredQty: number;
  allocatedQty: number;
}

export interface CuttingGateInput {
  fabricBomLine: FabricBomLineAllocation | null;
}

export interface GateResult {
  passed: boolean;
  ruleId?: string;
  reason?: string;
}

/**
 * BR-06: CUTTING may not start unless fabric is fully allocated per the BOM.
 */
export function evaluateCuttingGate(input: CuttingGateInput): GateResult {
  if (!input.fabricBomLine) {
    return {
      passed: false,
      ruleId: 'BR-06',
      reason: 'BR-06: Order does not have a fabric BOM line calculated.',
    };
  }

  // Floating point precision check: difference > 0.001
  const difference = input.fabricBomLine.requiredQty - input.fabricBomLine.allocatedQty;
  if (difference > 0.001) {
    return {
      passed: false,
      ruleId: 'BR-06',
      reason: `BR-06: CUTTING may not start unless fabric is fully allocated per the BOM. Required: ${input.fabricBomLine.requiredQty}, Allocated: ${input.fabricBomLine.allocatedQty}, Missing: ${Number(difference.toFixed(3))}.`,
    };
  }

  return { passed: true };
}
