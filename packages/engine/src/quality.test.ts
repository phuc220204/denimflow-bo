import { describe, expect, it } from 'vitest';
import {
  evaluateQcInspection,
  evaluateReworkRouting,
  type QcProfileSnapshot,
  type QcInspectionEvaluationInput,
  StandardQcStrategy,
} from './quality.js';

describe('Quality Strategy Engine (T5.1, FR-16, BR-19)', () => {
  const fullProcessProfile: QcProfileSnapshot = {
    id: 'qc-prof-full',
    profileType: 'FULL_PROCESS',
    maxShrinkagePercent: 3.0,
    maxColorFadingLevel: 2,
  };

  const skipCleanWashProfile: QcProfileSnapshot = {
    id: 'qc-prof-skip',
    profileType: 'SKIP_CLEAN_WASH',
    maxShrinkagePercent: 5.5,
    maxColorFadingLevel: 4,
  };

  it('T5.1 Acceptance: same measured values pass under SKIP_CLEAN_WASH and fail under FULL_PROCESS when thresholds differ', () => {
    // Intermediate measured values: shrinkage 4.2% (> 3.0% but <= 5.5%), fading level 3 (> 2 but <= 4)
    const measuredInput: QcInspectionEvaluationInput = {
      sampleSize: 100,
      measuredShrinkagePercent: 4.2,
      measuredColorFadingLevel: 3,
      defects: [{ defectType: 'STITCHING', qty: 1 }],
      maxAllowedDefectRatePercent: 2.0,
    };

    // 1. Evaluate under FULL_PROCESS -> Must FAIL
    const fullProcessResult = evaluateQcInspection(measuredInput, fullProcessProfile);
    expect(fullProcessResult.passed).toBe(false);
    expect(fullProcessResult.proposedResult).toBe('REWORK');
    expect(fullProcessResult.shrinkagePassed).toBe(false);
    expect(fullProcessResult.colorFadingPassed).toBe(false);
    expect(fullProcessResult.defectRatePassed).toBe(true);
    expect(fullProcessResult.reasons.length).toBeGreaterThan(0);

    // 2. Evaluate under SKIP_CLEAN_WASH -> Must PASS
    const skipCleanWashResult = evaluateQcInspection(measuredInput, skipCleanWashProfile);
    expect(skipCleanWashResult.passed).toBe(true);
    expect(skipCleanWashResult.proposedResult).toBe('PASS');
    expect(skipCleanWashResult.shrinkagePassed).toBe(true);
    expect(skipCleanWashResult.colorFadingPassed).toBe(true);
    expect(skipCleanWashResult.defectRatePassed).toBe(true);
    expect(skipCleanWashResult.reasons).toHaveLength(0);
  });

  it('proposes PASS when all measurements and defects are within threshold', () => {
    const perfectInput: QcInspectionEvaluationInput = {
      sampleSize: 50,
      measuredShrinkagePercent: 2.0,
      measuredColorFadingLevel: 1,
      defects: [],
    };

    const result = evaluateQcInspection(perfectInput, fullProcessProfile);
    expect(result.passed).toBe(true);
    expect(result.proposedResult).toBe('PASS');
    expect(result.totalDefectQty).toBe(0);
  });

  it('proposes REWORK when defect rate exceeds 2% but is below 25%', () => {
    const input: QcInspectionEvaluationInput = {
      sampleSize: 100,
      measuredShrinkagePercent: 2.0,
      measuredColorFadingLevel: 1,
      defects: [
        { defectType: 'BROKEN_STITCH', qty: 5 },
        { defectType: 'OIL_STAIN', qty: 2 },
      ],
      maxAllowedDefectRatePercent: 2.0,
    };

    const result = evaluateQcInspection(input, fullProcessProfile);
    expect(result.passed).toBe(false);
    expect(result.proposedResult).toBe('REWORK');
    expect(result.totalDefectQty).toBe(7);
    expect(result.defectRatePercent).toBe(7.0);
  });

  it('proposes REJECT when defect rate is catastrophic (> 25%)', () => {
    const input: QcInspectionEvaluationInput = {
      sampleSize: 100,
      measuredShrinkagePercent: 2.0,
      measuredColorFadingLevel: 1,
      defects: [{ defectType: 'TORN_FABRIC', qty: 30 }],
      maxAllowedDefectRatePercent: 2.0,
    };

    const result = evaluateQcInspection(input, fullProcessProfile);
    expect(result.passed).toBe(false);
    expect(result.proposedResult).toBe('REJECT');
    expect(result.totalDefectQty).toBe(30);
    expect(result.defectRatePercent).toBe(30.0);
  });

  it('StandardQcStrategy implements QcEvaluationStrategy interface', () => {
    const strategy = new StandardQcStrategy();
    expect(strategy.name).toBe('StandardQcStrategy');
    const res = strategy.evaluate(
      { sampleSize: 10, measuredShrinkagePercent: 1.0, measuredColorFadingLevel: 1 },
      fullProcessProfile,
    );
    expect(res.passed).toBe(true);
  });
});

describe('Rework Routing Engine (T5.2, FR-17, BR-10)', () => {
  it('rejects rework when reason is missing or empty (mandatory reason)', () => {
    const res = evaluateReworkRouting({
      currentStepId: 'step-qc-13',
      targetStepId: 'step-sew-8',
      currentStepSeq: 13,
      targetStepSeq: 8,
      targetReworkCount: 0,
      maxRework: 2,
      reason: '',
    });

    expect(res.allowed).toBe(false);
    expect(res.errorMessage).toContain('Lý do làm lại/từ chối là bắt buộc');
  });

  it('rejects rework when target step sequence is greater than current step sequence', () => {
    const res = evaluateReworkRouting({
      currentStepId: 'step-sew-8',
      targetStepId: 'step-qc-13',
      currentStepSeq: 8,
      targetStepSeq: 13,
      targetReworkCount: 0,
      maxRework: 2,
      reason: 'Lỗi đường chỉ',
    });

    expect(res.allowed).toBe(false);
    expect(res.errorMessage).toContain('Công đoạn làm lại phải là công đoạn trước đó');
  });

  it('allows rework when rework count is below maxRework limit', () => {
    const res = evaluateReworkRouting({
      currentStepId: 'step-qc-13',
      targetStepId: 'step-sew-8',
      currentStepSeq: 13,
      targetStepSeq: 8,
      targetReworkCount: 1,
      maxRework: 2,
      reason: 'Đường chỉ bị sút ở túi sau',
    });

    expect(res.allowed).toBe(true);
    expect(res.exceedsMaxRework).toBe(false);
    expect(res.reworkCount).toBe(2);
  });

  it('flags for Planner exception handling and blocks rework when rework count reaches maxRework', () => {
    const res = evaluateReworkRouting({
      currentStepId: 'step-qc-13',
      targetStepId: 'step-sew-8',
      currentStepSeq: 13,
      targetStepSeq: 8,
      targetReworkCount: 2,
      maxRework: 2,
      reason: 'Vẫn bị lỗi đường may sau 2 lần sửa',
    });

    expect(res.allowed).toBe(false);
    expect(res.exceedsMaxRework).toBe(true);
    expect(res.errorMessage).toContain('Vượt quá giới hạn làm lại tối đa');
  });
});
