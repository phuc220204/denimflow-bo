import { describe, expect, it } from 'vitest';
import { evaluateQcInspection, type QcProfileThresholds } from './quality.js';

// Seed demo thresholds (R-14).
const FULL_PROCESS: QcProfileThresholds = {
  profileType: 'FULL_PROCESS',
  maxShrinkagePercent: 3,
  maxColorFadingLevel: 1,
};
const SKIP_CLEAN_WASH: QcProfileThresholds = {
  profileType: 'SKIP_CLEAN_WASH',
  maxShrinkagePercent: 5,
  maxColorFadingLevel: 2,
};

describe('evaluateQcInspection (FR-16)', () => {
  it('BR-19 the same shrinkage passes SKIP_CLEAN_WASH and fails FULL_PROCESS', () => {
    const measurements = { sampleSize: 20, measuredShrinkagePercent: 4 };

    expect(evaluateQcInspection(measurements, SKIP_CLEAN_WASH).proposedResult).toBe('PASS');
    const full = evaluateQcInspection(measurements, FULL_PROCESS);
    expect(full.proposedResult).toBe('REWORK');
    expect(full.criteria[0]).toMatchObject({ criterion: 'SHRINKAGE', passed: false, limit: 3 });
    expect(full.criteria[0]?.reason).toContain('vượt ngưỡng FULL_PROCESS');
  });

  it('BR-19 the same color fading passes SKIP_CLEAN_WASH and fails FULL_PROCESS', () => {
    const measurements = { sampleSize: 20, measuredColorFadingLevel: 2 };
    expect(evaluateQcInspection(measurements, SKIP_CLEAN_WASH).proposedResult).toBe('PASS');
    expect(evaluateQcInspection(measurements, FULL_PROCESS).proposedResult).toBe('REWORK');
  });

  it('accepts values exactly at the threshold', () => {
    expect(
      evaluateQcInspection(
        { sampleSize: 10, measuredShrinkagePercent: 3, measuredColorFadingLevel: 1 },
        FULL_PROCESS,
      ).proposedResult,
    ).toBe('PASS');
  });

  it('does not judge a criterion that was not measured', () => {
    const result = evaluateQcInspection({ sampleSize: 10 }, FULL_PROCESS);
    expect(result).toMatchObject({ proposedResult: 'PASS', criteria: [] });
  });

  it('R-24 reports the defect rate without changing the proposal', () => {
    const result = evaluateQcInspection(
      {
        sampleSize: 40,
        measuredShrinkagePercent: 2,
        defects: [
          { defectType: 'Đường may lỗi', qty: 8 },
          { defectType: 'Lỗi vải', qty: 2 },
        ],
      },
      FULL_PROCESS,
    );
    expect(result).toMatchObject({
      proposedResult: 'PASS',
      totalDefectQty: 10,
      defectRatePercent: 25,
    });
  });
});
