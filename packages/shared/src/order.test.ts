import { describe, expect, it } from 'vitest';
import { DyeMode, DyeSource } from './enums.js';
import { createProductionOrderSchema, updateProductionOrderSchema } from './order.js';

describe('order schemas (shared)', () => {
  const validStyleId = '11111111-1111-4111-8111-111111111111';

  it('validates a correct production order draft', () => {
    const valid = createProductionOrderSchema.safeParse({
      styleId: validStyleId,
      dueDate: '2026-11-01',
      customerRef: 'PO-CLIENT-99',
      notes: 'Test order draft',
      washTypeId: null,
      dyeRequired: false,
      sizeLines: [
        { size: '28', plannedQty: 100 },
        { size: '30', plannedQty: 200 },
      ],
    });

    expect(valid.success).toBe(true);
  });

  it('requires dyeMode and dyeSource when dyeRequired is true', () => {
    const invalid = createProductionOrderSchema.safeParse({
      styleId: validStyleId,
      dueDate: '2026-11-01',
      dyeRequired: true,
      sizeLines: [{ size: '29', plannedQty: 50 }],
    });

    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      const paths = invalid.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('dyeMode');
      expect(paths).toContain('dyeSource');
    }

    const validWithDye = createProductionOrderSchema.safeParse({
      styleId: validStyleId,
      dueDate: '2026-11-01',
      dyeRequired: true,
      dyeMode: DyeMode.TOTAL,
      dyeSource: DyeSource.OUTSOURCED,
      sizeLines: [{ size: '29', plannedQty: 50 }],
    });
    expect(validWithDye.success).toBe(true);
  });

  it('enforces BR-17: ppSampleRequired must be true when isCustom is true', () => {
    const invalidCustom = createProductionOrderSchema.safeParse({
      styleId: validStyleId,
      dueDate: '2026-11-01',
      isCustom: true,
      ppSampleRequired: false,
      sizeLines: [{ size: '32', plannedQty: 100 }],
    });

    expect(invalidCustom.success).toBe(false);
    if (!invalidCustom.success) {
      expect(invalidCustom.error.issues[0]?.message).toMatch(/BR-17/);
    }

    const validCustom = createProductionOrderSchema.safeParse({
      styleId: validStyleId,
      dueDate: '2026-11-01',
      isCustom: true,
      ppSampleRequired: true,
      sizeLines: [{ size: '32', plannedQty: 100 }],
    });
    expect(validCustom.success).toBe(true);
  });

  it('rejects duplicate sizes in sizeLines', () => {
    const duplicate = createProductionOrderSchema.safeParse({
      styleId: validStyleId,
      dueDate: '2026-11-01',
      sizeLines: [
        { size: '30', plannedQty: 100 },
        { size: '30', plannedQty: 50 },
      ],
    });

    expect(duplicate.success).toBe(false);
    if (!duplicate.success) {
      expect(duplicate.error.issues[0]?.message).toMatch(/Duplicate size/);
    }
  });

  it('rejects non-positive plannedQty or empty sizeLines', () => {
    const nonPositive = createProductionOrderSchema.safeParse({
      styleId: validStyleId,
      dueDate: '2026-11-01',
      sizeLines: [{ size: '30', plannedQty: 0 }],
    });
    expect(nonPositive.success).toBe(false);

    const empty = createProductionOrderSchema.safeParse({
      styleId: validStyleId,
      dueDate: '2026-11-01',
      sizeLines: [],
    });
    expect(empty.success).toBe(false);
  });

  it('validates update order draft', () => {
    const update = updateProductionOrderSchema.safeParse({
      notes: 'Updated note',
      sizeLines: [
        { size: '31', plannedQty: 150 },
        { size: '32', plannedQty: 250 },
      ],
    });
    expect(update.success).toBe(true);
  });
});
