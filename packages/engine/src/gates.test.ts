import { describe, expect, it } from 'vitest';
import { evaluateCuttingGate } from './gates.js';

describe('evaluateCuttingGate (BR-06 Gate Check)', () => {
  it('BR-06: blocks CUTTING if fabric BOM line is missing', () => {
    const result = evaluateCuttingGate({ fabricBomLine: null });
    expect(result.passed).toBe(false);
    expect(result.ruleId).toBe('BR-06');
    expect(result.reason).toContain('Order does not have a fabric BOM line calculated');
  });

  it('BR-06: blocks CUTTING if fabric is only partially allocated', () => {
    const result = evaluateCuttingGate({
      fabricBomLine: {
        requiredQty: 400,
        allocatedQty: 250,
      },
    });
    expect(result.passed).toBe(false);
    expect(result.ruleId).toBe('BR-06');
    expect(result.reason).toContain('Required: 400, Allocated: 250, Missing: 150');
  });

  it('BR-06: passes CUTTING gate when fabric is 100% allocated', () => {
    const result = evaluateCuttingGate({
      fabricBomLine: {
        requiredQty: 400,
        allocatedQty: 400,
      },
    });
    expect(result.passed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('BR-06: passes CUTTING gate when allocated qty slightly exceeds or matches with floating precision', () => {
    const result = evaluateCuttingGate({
      fabricBomLine: {
        requiredQty: 382.5,
        allocatedQty: 382.5004,
      },
    });
    expect(result.passed).toBe(true);
  });
});
