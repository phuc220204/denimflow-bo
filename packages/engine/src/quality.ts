// Workflow engine: pure TypeScript, no framework, database or I/O imports
// (see .agents/rules/01-architecture-boundaries.md).
// QC inspection evaluation for FR-16 and BR-19: each QC Profile acts as a Strategy with its own
// thresholds. The proposal follows the profile only (R-24); defects are reported, never judged.

export interface QcProfileThresholds {
  profileType: 'FULL_PROCESS' | 'SKIP_CLEAN_WASH';
  maxShrinkagePercent: number;
  maxColorFadingLevel: number;
}

export interface QcMeasurements {
  sampleSize: number;
  measuredShrinkagePercent?: number | null;
  measuredColorFadingLevel?: number | null;
  defects?: Array<{ defectType: string; qty: number }>;
}

export interface QcCriterionResult {
  criterion: 'SHRINKAGE' | 'COLOR_FADING';
  measured: number;
  limit: number;
  passed: boolean;
  reason: string;
}

export interface QcEvaluation {
  profileType: QcProfileThresholds['profileType'];
  // PASS when every measured criterion is within the profile; REWORK otherwise. REJECT is only
  // ever chosen by the inspector (R-24).
  proposedResult: 'PASS' | 'REWORK';
  criteria: QcCriterionResult[];
  totalDefectQty: number;
  defectRatePercent: number;
}

export interface QcEvaluationStrategy {
  evaluate(measurements: QcMeasurements): QcEvaluation;
}

/**
 * BR-19: compares measured shrinkage and color fading with the thresholds of the order's QC
 * Profile (FULL_PROCESS or SKIP_CLEAN_WASH). A criterion that was not measured is not judged.
 */
export class ProfileThresholdStrategy implements QcEvaluationStrategy {
  constructor(private readonly profile: QcProfileThresholds) {}

  evaluate(measurements: QcMeasurements): QcEvaluation {
    const { profileType, maxShrinkagePercent, maxColorFadingLevel } = this.profile;
    const criteria: QcCriterionResult[] = [];

    const shrinkage = measurements.measuredShrinkagePercent;
    if (shrinkage !== undefined && shrinkage !== null) {
      const passed = shrinkage <= maxShrinkagePercent;
      criteria.push({
        criterion: 'SHRINKAGE',
        measured: shrinkage,
        limit: maxShrinkagePercent,
        passed,
        reason: passed
          ? `Độ co ${shrinkage}% trong ngưỡng ${profileType} (tối đa ${maxShrinkagePercent}%)`
          : `Độ co ${shrinkage}% vượt ngưỡng ${profileType} (tối đa ${maxShrinkagePercent}%)`,
      });
    }

    const fading = measurements.measuredColorFadingLevel;
    if (fading !== undefined && fading !== null) {
      const passed = fading <= maxColorFadingLevel;
      criteria.push({
        criterion: 'COLOR_FADING',
        measured: fading,
        limit: maxColorFadingLevel,
        passed,
        reason: passed
          ? `Mức phai màu ${fading} trong ngưỡng ${profileType} (tối đa mức ${maxColorFadingLevel})`
          : `Mức phai màu ${fading} vượt ngưỡng ${profileType} (tối đa mức ${maxColorFadingLevel})`,
      });
    }

    const totalDefectQty = (measurements.defects ?? []).reduce((sum, d) => sum + d.qty, 0);
    const defectRatePercent =
      measurements.sampleSize > 0
        ? Math.round((totalDefectQty / measurements.sampleSize) * 1000) / 10
        : 0;

    return {
      profileType,
      proposedResult: criteria.every((c) => c.passed) ? 'PASS' : 'REWORK',
      criteria,
      totalDefectQty,
      defectRatePercent,
    };
  }
}

export function evaluateQcInspection(
  measurements: QcMeasurements,
  profile: QcProfileThresholds,
  strategy: QcEvaluationStrategy = new ProfileThresholdStrategy(profile),
): QcEvaluation {
  return strategy.evaluate(measurements);
}
