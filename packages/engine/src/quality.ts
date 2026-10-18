// Workflow engine: pure TypeScript, no framework, database or I/O imports
// (see .agents/rules/01-architecture-boundaries.md).
// QC inspection evaluation Strategy (T5.1, FR-16, BR-11, BR-19).

export interface QcProfileSnapshot {
  id: string;
  profileType: 'FULL_PROCESS' | 'SKIP_CLEAN_WASH';
  maxShrinkagePercent: number;
  maxColorFadingLevel: number;
}

export interface DefectItem {
  defectType: string;
  qty: number;
}

export interface QcInspectionEvaluationInput {
  sampleSize: number;
  measuredShrinkagePercent?: number | null;
  measuredColorFadingLevel?: number | null;
  defects?: DefectItem[];
  maxAllowedDefectRatePercent?: number; // default: 2.0%
}

export interface QcEvaluationResult {
  passed: boolean;
  proposedResult: 'PASS' | 'REWORK' | 'REJECT';
  shrinkagePassed: boolean;
  colorFadingPassed: boolean;
  defectRatePassed: boolean;
  totalDefectQty: number;
  defectRatePercent: number;
  reasons: string[];
}

export interface QcStrategy {
  readonly name: string;
  evaluate(input: QcInspectionEvaluationInput, profile: QcProfileSnapshot): QcEvaluationResult;
}

/**
 * Standard QC Strategy comparing measured inspection parameters against
 * configured QC Profile thresholds (BR-19) and defect tolerances.
 */
export class StandardQcStrategy implements QcStrategy {
  readonly name = 'StandardQcStrategy';

  evaluate(input: QcInspectionEvaluationInput, profile: QcProfileSnapshot): QcEvaluationResult {
    const reasons: string[] = [];
    const maxDefectRate = input.maxAllowedDefectRatePercent ?? 2.0;

    // 1. Shrinkage Check
    let shrinkagePassed = true;
    if (input.measuredShrinkagePercent !== undefined && input.measuredShrinkagePercent !== null) {
      if (input.measuredShrinkagePercent > profile.maxShrinkagePercent) {
        shrinkagePassed = false;
        reasons.push(
          `Độ co giãn (${input.measuredShrinkagePercent}%) vượt mức tối đa của tiêu chuẩn ${profile.profileType} (${profile.maxShrinkagePercent}%)`,
        );
      }
    }

    // 2. Color Fading Check
    let colorFadingPassed = true;
    if (input.measuredColorFadingLevel !== undefined && input.measuredColorFadingLevel !== null) {
      if (input.measuredColorFadingLevel > profile.maxColorFadingLevel) {
        colorFadingPassed = false;
        reasons.push(
          `Độ phai màu cấp ${input.measuredColorFadingLevel} vượt mức tối đa của tiêu chuẩn ${profile.profileType} (cấp ${profile.maxColorFadingLevel})`,
        );
      }
    }

    // 3. Defect Count & Rate Check
    const totalDefectQty = (input.defects ?? []).reduce((sum, d) => sum + d.qty, 0);
    const sampleSize = input.sampleSize > 0 ? input.sampleSize : 1;
    const defectRatePercent = (totalDefectQty / sampleSize) * 100;
    let defectRatePassed = true;

    if (defectRatePercent > maxDefectRate) {
      defectRatePassed = false;
      reasons.push(
        `Tỷ lệ khuyết tật (${defectRatePercent.toFixed(1)}%) vượt mức cho phép (${maxDefectRate}%)`,
      );
    }

    const passed = shrinkagePassed && colorFadingPassed && defectRatePassed;

    let proposedResult: 'PASS' | 'REWORK' | 'REJECT' = 'PASS';
    if (!passed) {
      // If defect rate is catastrophic (> 25%), propose REJECT; otherwise propose REWORK
      if (defectRatePercent > 25) {
        proposedResult = 'REJECT';
      } else {
        proposedResult = 'REWORK';
      }
    }

    return {
      passed,
      proposedResult,
      shrinkagePassed,
      colorFadingPassed,
      defectRatePassed,
      totalDefectQty,
      defectRatePercent: Math.round(defectRatePercent * 10) / 10,
      reasons,
    };
  }
}

export function evaluateQcInspection(
  input: QcInspectionEvaluationInput,
  profile: QcProfileSnapshot,
  strategy: QcStrategy = new StandardQcStrategy(),
): QcEvaluationResult {
  return strategy.evaluate(input, profile);
}
