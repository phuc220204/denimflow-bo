import { describe, expect, it } from 'vitest';
import {
  checkStepBalance,
  generateBundles,
  maxCutQty,
  negateEntry,
  quantityIn,
  validateQuantityEntry,
  type QuantityEntryContext,
} from './quantities.js';

const cutting = (cutSoFar: number, tolerancePercent = 5): QuantityEntryContext => ({
  isOutsourced: false,
  limit: { mode: 'CUTTING', size: '30', plannedQty: 100, tolerancePercent, cutSoFar },
});

const handover = (available: number, takenSoFar: number, isOutsourced = false) => ({
  isOutsourced,
  limit: { mode: 'HANDOVER' as const, limits: [{ label: 'Bó B001', available, takenSoFar }] },
});

describe('BR-07 cut tolerance', () => {
  it('BR-07 allows up to plan + 5% rounded down', () => {
    expect(maxCutQty(100, 5)).toBe(105);
    expect(maxCutQty(33, 5)).toBe(34);
    expect(validateQuantityEntry({ qtyGood: 100, qtyDefect: 5 }, cutting(0)).valid).toBe(true);
  });

  it('BR-07 rejects a cut that exceeds plan + tolerance, counting defects too', () => {
    const result = validateQuantityEntry({ qtyGood: 4, qtyDefect: 2 }, cutting(100));
    expect(result).toMatchObject({ valid: false, ruleId: 'BR-07' });
    expect(result.reason).toContain('tối đa 105');
  });

  it('BR-07 handles a tolerance with decimals exactly', () => {
    expect(maxCutQty(100, 2.5)).toBe(102);
    expect(maxCutQty(1000, 0.1)).toBe(1001);
  });
});

describe('BR-08 quantity conservation', () => {
  it('BR-08 counts earlier defects as taken (50 good + 50 defect, then 50 more is rejected)', () => {
    const first = { qtyGood: 50, qtyDefect: 50 };
    expect(validateQuantityEntry(first, handover(100, 0)).valid).toBe(true);

    const second = validateQuantityEntry(
      { qtyGood: 50, qtyDefect: 0 },
      handover(100, quantityIn(first, false)),
    );
    expect(second).toMatchObject({ valid: false, ruleId: 'BR-08' });
  });

  it('BR-08 checks every limit (bundle and step)', () => {
    const result = validateQuantityEntry(
      { qtyGood: 10, qtyDefect: 0 },
      {
        isOutsourced: false,
        limit: {
          mode: 'HANDOVER',
          limits: [
            { label: 'Bó B001', available: 50, takenSoFar: 0 },
            { label: 'Bước SEWING', available: 100, takenSoFar: 95 },
          ],
        },
      },
    );
    expect(result.reason).toContain('Bước SEWING chỉ còn 5');
  });

  it('BR-08 requires everything handed over to be accounted for before completion', () => {
    expect(checkStepBalance(100, 100).valid).toBe(true);
    expect(checkStepBalance(80, 100)).toMatchObject({ valid: false, ruleId: 'BR-08' });
  });
});

describe('BR-09 outsourced reconciliation', () => {
  it('BR-09 requires both sent and received at an outsourced station', () => {
    expect(
      validateQuantityEntry({ qtyGood: 50, qtyDefect: 0 }, handover(50, 0, true)),
    ).toMatchObject({ valid: false, ruleId: 'BR-09' });
  });

  it('BR-09 requires a reason when received differs from sent', () => {
    const entry = { qtyGood: 47, qtyDefect: 1, qtySent: 50, qtyReceived: 48 };
    expect(validateQuantityEntry(entry, handover(50, 0, true)).ruleId).toBe('BR-09');
    expect(
      validateQuantityEntry(
        { ...entry, mismatchReason: 'Xưởng nhuộm làm hỏng 2' },
        handover(50, 0, true),
      ).valid,
    ).toBe(true);
  });

  it('BR-09 rejects receiving more than was sent, or good + defect different from received', () => {
    expect(
      validateQuantityEntry(
        { qtyGood: 51, qtyDefect: 0, qtySent: 50, qtyReceived: 51, mismatchReason: 'x' },
        handover(60, 0, true),
      ).reason,
    ).toContain('không được lớn hơn');
    expect(
      validateQuantityEntry(
        { qtyGood: 40, qtyDefect: 0, qtySent: 50, qtyReceived: 50 },
        handover(50, 0, true),
      ).reason,
    ).toContain('phải bằng số nhận về');
  });

  it('BR-09 counts what was sent as taken into the step', () => {
    const entry = {
      qtyGood: 48,
      qtyDefect: 0,
      qtySent: 50,
      qtyReceived: 48,
      mismatchReason: 'Mất 2',
    };
    expect(quantityIn(entry, true)).toBe(50);
    expect(validateQuantityEntry(entry, handover(49, 0, true)).ruleId).toBe('BR-08');
  });

  it('BR-09 rejects sent/received at an in-house station', () => {
    expect(
      validateQuantityEntry(
        { qtyGood: 10, qtyDefect: 0, qtySent: 10, qtyReceived: 10 },
        handover(50, 0),
      ).ruleId,
    ).toBe('BR-09');
  });
});

describe('negateEntry', () => {
  it('produces the exact compensating values', () => {
    expect(negateEntry({ qtyGood: 48, qtyDefect: 2, qtySent: 50, qtyReceived: 50 })).toEqual({
      qtyGood: -48,
      qtyDefect: -2,
      qtySent: -50,
      qtyReceived: -50,
      mismatchReason: null,
    });
    expect(negateEntry({ qtyGood: 5, qtyDefect: 0 }).qtySent).toBeNull();
  });
});

describe('generateBundles (FR-15)', () => {
  it('splits good pieces per size into bundles of 50 with codes running across sizes', () => {
    const bundles = generateBundles('PO-20261019-001', [
      { size: '30', qty: 120 },
      { size: '31', qty: 0 },
      { size: '32', qty: 50 },
    ]);
    expect(bundles).toEqual([
      { bundleCode: 'PO-20261019-001-B001', size: '30', qty: 50 },
      { bundleCode: 'PO-20261019-001-B002', size: '30', qty: 50 },
      { bundleCode: 'PO-20261019-001-B003', size: '30', qty: 20 },
      { bundleCode: 'PO-20261019-001-B004', size: '32', qty: 50 },
    ]);
  });
});
