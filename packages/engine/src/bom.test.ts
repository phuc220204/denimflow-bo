import { MaterialType } from '@denimflow/shared';
import { describe, expect, it } from 'vitest';
import {
  BomCalculator,
  type BomNormInput,
  type OrderSizeLineInput,
  SizeNormBomStrategy,
} from './bom.js';

describe('BOM Calculation Strategy (T3.3, FR-09)', () => {
  const norms: BomNormInput[] = [
    // FABRIC per size (with 5% cutting wastage)
    {
      materialType: MaterialType.FABRIC,
      size: '29',
      qtyPerPiece: 1.35,
      unit: 'meter',
      wastagePercent: 5,
    },
    {
      materialType: MaterialType.FABRIC,
      size: '30',
      qtyPerPiece: 1.4,
      unit: 'meter',
      wastagePercent: 5,
    },
    {
      materialType: MaterialType.FABRIC,
      size: '31',
      qtyPerPiece: 1.45,
      unit: 'meter',
      wastagePercent: 5,
    },
    {
      materialType: MaterialType.FABRIC,
      size: '32',
      qtyPerPiece: 1.5,
      unit: 'meter',
      wastagePercent: 5,
    },

    // Universal trims across all sizes
    // THREAD: 120m per piece + 8% wastage
    {
      materialType: MaterialType.THREAD,
      size: null,
      qtyPerPiece: 120,
      unit: 'meter',
      wastagePercent: 8,
    },
    // BUTTON: 1 pc per piece + 2% wastage
    {
      materialType: MaterialType.BUTTON,
      size: null,
      qtyPerPiece: 1,
      unit: 'piece',
      wastagePercent: 2,
    },
    // RIVET: 6 pcs per piece + 3% wastage
    {
      materialType: MaterialType.RIVET,
      size: null,
      qtyPerPiece: 6,
      unit: 'piece',
      wastagePercent: 3,
    },
    // ZIPPER: 1 pc per piece (0% wastage)
    {
      materialType: MaterialType.ZIPPER,
      size: null,
      qtyPerPiece: 1,
      unit: 'piece',
      wastagePercent: 0,
    },
    // LABEL: 2 pcs per piece + 1% wastage
    {
      materialType: MaterialType.LABEL,
      size: null,
      qtyPerPiece: 2,
      unit: 'piece',
      wastagePercent: 1,
    },
    // PACKAGING: 1 pc per piece (polybag + carton norm)
    {
      materialType: MaterialType.PACKAGING,
      size: null,
      qtyPerPiece: 1,
      unit: 'piece',
      wastagePercent: 0,
    },
  ];

  it('determines exact BOM requirements for a known size run', () => {
    const sizeLines: OrderSizeLineInput[] = [
      { size: '29', plannedQty: 100 },
      { size: '30', plannedQty: 150 },
      { size: '31', plannedQty: 150 },
      { size: '32', plannedQty: 100 },
    ];
    // Total pieces = 100 + 150 + 150 + 100 = 500 pieces

    // Expected Fabric calculation:
    // Size 29: 100 * 1.35 * 1.05 = 141.75
    // Size 30: 150 * 1.40 * 1.05 = 220.5
    // Size 31: 150 * 1.45 * 1.05 = 228.375
    // Size 32: 100 * 1.50 * 1.05 = 157.5
    // Total Fabric = 141.75 + 220.5 + 228.375 + 157.5 = 748.125 meters

    // Expected Thread: 500 * 120 * 1.08 = 64800 meters
    // Expected Button: 500 * 1 * 1.02 = 510 pieces
    // Expected Rivet: 500 * 6 * 1.03 = 3090 pieces
    // Expected Zipper: 500 * 1 * 1.00 = 500 pieces
    // Expected Label: 500 * 2 * 1.01 = 1010 pieces
    // Expected Packaging: 500 * 1 * 1.00 = 500 pieces

    const calculator = new BomCalculator();
    const result = calculator.calculate({ sizeLines, norms });

    expect(result).toHaveLength(7);

    const fabric = result.find((l) => l.materialType === MaterialType.FABRIC);
    expect(fabric).toEqual({
      materialType: MaterialType.FABRIC,
      requiredQty: 748.125,
      unit: 'meter',
    });

    const thread = result.find((l) => l.materialType === MaterialType.THREAD);
    expect(thread).toEqual({
      materialType: MaterialType.THREAD,
      requiredQty: 64800,
      unit: 'meter',
    });

    const button = result.find((l) => l.materialType === MaterialType.BUTTON);
    expect(button).toEqual({
      materialType: MaterialType.BUTTON,
      requiredQty: 510,
      unit: 'piece',
    });

    const rivet = result.find((l) => l.materialType === MaterialType.RIVET);
    expect(rivet).toEqual({
      materialType: MaterialType.RIVET,
      requiredQty: 3090,
      unit: 'piece',
    });

    const zipper = result.find((l) => l.materialType === MaterialType.ZIPPER);
    expect(zipper).toEqual({
      materialType: MaterialType.ZIPPER,
      requiredQty: 500,
      unit: 'piece',
    });

    const label = result.find((l) => l.materialType === MaterialType.LABEL);
    expect(label).toEqual({
      materialType: MaterialType.LABEL,
      requiredQty: 1010,
      unit: 'piece',
    });

    const packaging = result.find((l) => l.materialType === MaterialType.PACKAGING);
    expect(packaging).toEqual({
      materialType: MaterialType.PACKAGING,
      requiredQty: 500,
      unit: 'piece',
    });
  });

  it('handles case when some sizes in order have no matching size norm', () => {
    const sizeLines: OrderSizeLineInput[] = [
      { size: '29', plannedQty: 50 },
      { size: '36', plannedQty: 50 }, // size 36 has no fabric norm in our list
    ];

    const strategy = new SizeNormBomStrategy();
    const result = strategy.calculate({ sizeLines, norms });

    // Fabric only comes from size 29: 50 * 1.35 * 1.05 = 70.875
    const fabric = result.find((l) => l.materialType === MaterialType.FABRIC);
    expect(fabric?.requiredQty).toBe(70.875);

    // Universal trims apply to total (100 pcs):
    // Zipper: 100 * 1 = 100
    const zipper = result.find((l) => l.materialType === MaterialType.ZIPPER);
    expect(zipper?.requiredQty).toBe(100);
  });

  it('returns empty list when size lines or norms are empty', () => {
    const calculator = new BomCalculator();
    expect(calculator.calculate({ sizeLines: [], norms })).toEqual([]);
    expect(
      calculator.calculate({ sizeLines: [{ size: '30', plannedQty: 10 }], norms: [] }),
    ).toEqual([]);
  });

  it('supports universal norms specified with size "ALL" or "*"', () => {
    const customNorms: BomNormInput[] = [
      {
        materialType: MaterialType.BUTTON,
        size: 'ALL',
        qtyPerPiece: 2,
        unit: 'piece',
        wastagePercent: 0,
      },
      {
        materialType: MaterialType.RIVET,
        size: '*',
        qtyPerPiece: 4,
        unit: 'piece',
        wastagePercent: 0,
      },
    ];

    const calculator = new BomCalculator();
    const result = calculator.calculate({
      sizeLines: [
        { size: '29', plannedQty: 50 },
        { size: '30', plannedQty: 50 },
      ],
      norms: customNorms,
    });

    expect(result).toEqual([
      { materialType: MaterialType.BUTTON, requiredQty: 200, unit: 'piece' },
      { materialType: MaterialType.RIVET, requiredQty: 400, unit: 'piece' },
    ]);
  });
});
