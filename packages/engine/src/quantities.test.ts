import { describe, expect, it } from 'vitest';
import { generateBundlesForCutting, validateQuantityEntry } from './quantities.js';

describe('validateQuantityEntry (BR-07, BR-08, BR-09)', () => {
  it('BR-07: rejects cut quantity exceeding plan plus tolerance', () => {
    const res = validateQuantityEntry({
      stepCode: 'CUTTING',
      isCutting: true,
      plannedQtyForSize: 100,
      cutTolerancePercent: 5,
      existingCutQtyForSize: 95,
      entryQtyGood: 15, // total 110 > 105
    });

    expect(res.valid).toBe(false);
    expect(res.ruleId).toBe('BR-07');
    expect(res.reason).toContain('exceeds planned quantity (100) plus 5% tolerance');
  });

  it('BR-07: accepts cut quantity within plan plus tolerance', () => {
    const res = validateQuantityEntry({
      stepCode: 'CUTTING',
      isCutting: true,
      plannedQtyForSize: 100,
      cutTolerancePercent: 5,
      existingCutQtyForSize: 90,
      entryQtyGood: 14, // total 104 <= 105
    });

    expect(res.valid).toBe(true);
  });

  it('BR-08: rejects entry quantity exceeding previous step good quantity', () => {
    const res = validateQuantityEntry({
      stepCode: 'SEWING',
      isCutting: false,
      previousStepGoodQty: 100,
      currentStepTotalGoodSoFar: 90,
      entryQtyGood: 15, // total 105 > 100
    });

    expect(res.valid).toBe(false);
    expect(res.ruleId).toBe('BR-08');
    expect(res.reason).toContain("exceeds previous step's good quantity");
  });

  it('BR-08: accepts entry quantity within previous step good quantity', () => {
    const res = validateQuantityEntry({
      stepCode: 'SEWING',
      isCutting: false,
      previousStepGoodQty: 100,
      currentStepTotalGoodSoFar: 90,
      entryQtyGood: 10, // total 100 <= 100
    });

    expect(res.valid).toBe(true);
  });

  it('BR-09: rejects outsourced quantity mismatch without recorded reason', () => {
    const res = validateQuantityEntry({
      stepCode: 'DYEING',
      isCutting: false,
      isOutsourced: true,
      qtySent: 100,
      qtyReceived: 95,
      mismatchReason: '',
      entryQtyGood: 95,
    });

    expect(res.valid).toBe(false);
    expect(res.ruleId).toBe('BR-09');
    expect(res.reason).toContain('requires a recorded reason');
  });

  it('BR-09: accepts outsourced quantity mismatch when reason is provided', () => {
    const res = validateQuantityEntry({
      stepCode: 'DYEING',
      isCutting: false,
      isOutsourced: true,
      qtySent: 100,
      qtyReceived: 95,
      mismatchReason: '5 samples damaged during test wash at subcontractor',
      entryQtyGood: 95,
    });

    expect(res.valid).toBe(true);
  });
});

describe('generateBundlesForCutting (FR-15)', () => {
  it('generates bundle codes formatted as PO-xxx-B001 and splits sizes into bundles', () => {
    const bundles = generateBundlesForCutting(
      'PO-20261018-001',
      [
        { size: '30', plannedQty: 120 },
        { size: '32', plannedQty: 45 },
      ],
      50,
    );

    expect(bundles).toHaveLength(4);

    expect(bundles[0]).toEqual({
      bundleCode: 'PO-20261018-001-B001',
      size: '30',
      qty: 50,
    });
    expect(bundles[1]).toEqual({
      bundleCode: 'PO-20261018-001-B002',
      size: '30',
      qty: 50,
    });
    expect(bundles[2]).toEqual({
      bundleCode: 'PO-20261018-001-B003',
      size: '30',
      qty: 20,
    });
    expect(bundles[3]).toEqual({
      bundleCode: 'PO-20261018-001-B004',
      size: '32',
      qty: 45,
    });
  });
});
