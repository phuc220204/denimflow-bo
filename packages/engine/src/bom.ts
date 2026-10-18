import type { MaterialType } from '@denimflow/shared';

// Workflow engine: pure TypeScript, no framework, database or I/O imports
// (see .agents/rules/01-architecture-boundaries.md).
// Evaluates Bill of Materials (BOM) calculation strategies (T3.3, FR-09).

export interface OrderSizeLineInput {
  size: string;
  plannedQty: number;
}

export interface BomNormInput {
  size?: string | null;
  materialType: MaterialType;
  qtyPerPiece: number;
  unit: string;
  wastagePercent?: number; // e.g. 5 for 5%
}

export interface CalculatedBomLine {
  materialType: MaterialType;
  requiredQty: number;
  unit: string;
}

export interface BomCalculationInput {
  sizeLines: OrderSizeLineInput[];
  norms: BomNormInput[];
}

export interface BomCalculationStrategy {
  calculate(input: BomCalculationInput): CalculatedBomLine[];
}

/**
 * Size-norm BOM Calculation Strategy (T3.3, FR-09):
 * Computes material requirements by multiplying the planned quantities of sizes
 * with norms per size (or universal norms if size is null/empty), including wastage percentage.
 *
 * Formula per norm:
 * applicableQty * qtyPerPiece * (1 + wastagePercent / 100)
 */
export class SizeNormBomStrategy implements BomCalculationStrategy {
  calculate(input: BomCalculationInput): CalculatedBomLine[] {
    const { sizeLines, norms } = input;
    const materialMap = new Map<MaterialType, { totalQty: number; unit: string }>();

    for (const norm of norms) {
      const wastageMultiplier = 1 + (Number(norm.wastagePercent) || 0) / 100;

      const isUniversal =
        !norm.size ||
        norm.size.trim() === '' ||
        norm.size.trim() === '*' ||
        norm.size.trim().toUpperCase() === 'ALL';

      const applicableQty = !isUniversal
        ? (sizeLines.find((l) => l.size.trim().toUpperCase() === norm.size!.trim().toUpperCase())
            ?.plannedQty ?? 0)
        : sizeLines.reduce((acc, curr) => acc + (curr.plannedQty || 0), 0);

      if (applicableQty <= 0) continue;

      const subtotal = applicableQty * Number(norm.qtyPerPiece) * wastageMultiplier;
      const existing = materialMap.get(norm.materialType);
      if (existing) {
        existing.totalQty += subtotal;
      } else {
        materialMap.set(norm.materialType, {
          totalQty: subtotal,
          unit: norm.unit,
        });
      }
    }

    const results: CalculatedBomLine[] = [];
    for (const [materialType, data] of materialMap.entries()) {
      results.push({
        materialType,
        requiredQty: Math.round(data.totalQty * 1000) / 1000,
        unit: data.unit,
      });
    }

    // Deterministic sort by materialType
    return results.sort((a, b) => a.materialType.localeCompare(b.materialType));
  }
}

/**
 * BOM Calculator runner using Strategy pattern.
 */
export class BomCalculator {
  constructor(private readonly strategy: BomCalculationStrategy = new SizeNormBomStrategy()) {}

  calculate(input: BomCalculationInput): CalculatedBomLine[] {
    return this.strategy.calculate(input);
  }
}
