import { describe, expect, it } from 'vitest';
import {
  createDefaultGateChain,
  evaluateCuttingGate,
  evaluateStepGates,
  evaluateStepReadiness,
  EvidencePresentGateHandler,
  MaterialAllocationGateHandler,
  PredecessorsDoneGateHandler,
  QcPassedGateHandler,
  QuantityConservationGateHandler,
  type GateCheckContext,
  type WorkflowInstanceSnapshot,
} from './gates.js';

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

describe('PredecessorsDoneGateHandler (BR-14)', () => {
  const handler = new PredecessorsDoneGateHandler();

  it('passes when step has no predecessors', () => {
    const ctx: GateCheckContext = {
      targetStep: { id: 's1', code: 'CUTTING', seq: 10, status: 'PENDING' },
      allSteps: [],
      predecessorSteps: [],
    };
    const res = handler.handle(ctx);
    expect(res.passed).toBe(true);
  });

  it('passes when all predecessors are DONE or SKIPPED', () => {
    const ctx: GateCheckContext = {
      targetStep: { id: 's2', code: 'SEWING', seq: 20, status: 'PENDING' },
      allSteps: [],
      predecessorSteps: [
        { id: 's1', code: 'CUTTING', seq: 10, status: 'DONE' },
        { id: 's1b', code: 'EMBROIDERY', seq: 15, status: 'SKIPPED' },
      ],
    };
    const res = handler.handle(ctx);
    expect(res.passed).toBe(true);
  });

  it('BR-14: blocks when any predecessor is PENDING or IN_PROGRESS', () => {
    const ctx: GateCheckContext = {
      targetStep: { id: 's2', code: 'SEWING', seq: 20, status: 'PENDING' },
      allSteps: [],
      predecessorSteps: [{ id: 's1', code: 'CUTTING', seq: 10, status: 'IN_PROGRESS' }],
    };
    const res = handler.handle(ctx);
    expect(res.passed).toBe(false);
    expect(res.ruleId).toBe('BR-14');
    expect(res.reason).toContain('Predecessor step CUTTING is not completed');
  });
});

describe('MaterialAllocationGateHandler (BR-06)', () => {
  const handler = new MaterialAllocationGateHandler();

  it('ignores non-CUTTING steps', () => {
    const ctx: GateCheckContext = {
      targetStep: { id: 's2', code: 'SEWING', seq: 20, status: 'PENDING' },
      allSteps: [],
      predecessorSteps: [],
      fabricBomLine: null,
    };
    const res = handler.handle(ctx);
    expect(res.passed).toBe(true);
  });

  it('BR-06: blocks CUTTING when fabric allocation is less than 100%', () => {
    const ctx: GateCheckContext = {
      targetStep: { id: 's1', code: 'CUTTING', seq: 10, status: 'PENDING' },
      allSteps: [],
      predecessorSteps: [],
      fabricBomLine: { requiredQty: 100, allocatedQty: 90 },
    };
    const res = handler.handle(ctx);
    expect(res.passed).toBe(false);
    expect(res.ruleId).toBe('BR-06');
  });

  it('passes CUTTING when fabric is 100% allocated', () => {
    const ctx: GateCheckContext = {
      targetStep: { id: 's1', code: 'CUTTING', seq: 10, status: 'PENDING' },
      allSteps: [],
      predecessorSteps: [],
      fabricBomLine: { requiredQty: 100, allocatedQty: 100 },
    };
    const res = handler.handle(ctx);
    expect(res.passed).toBe(true);
  });
});

describe('QuantityConservationGateHandler (BR-08)', () => {
  const handler = new QuantityConservationGateHandler();

  it('passes when step has no qtyIn specified', () => {
    const ctx: GateCheckContext = {
      targetStep: { id: 's2', code: 'SEWING', seq: 20, status: 'PENDING' },
      allSteps: [],
      predecessorSteps: [{ id: 's1', code: 'CUTTING', seq: 10, status: 'DONE', qtyGood: 100 }],
    };
    const res = handler.handle(ctx);
    expect(res.passed).toBe(true);
  });

  it('passes when qtyIn <= previous step good qty', () => {
    const ctx: GateCheckContext = {
      targetStep: { id: 's2', code: 'SEWING', seq: 20, status: 'PENDING', qtyIn: 98 },
      allSteps: [],
      predecessorSteps: [{ id: 's1', code: 'CUTTING', seq: 10, status: 'DONE', qtyGood: 100 }],
    };
    const res = handler.handle(ctx);
    expect(res.passed).toBe(true);
  });

  it('BR-08: blocks when qtyIn > previous step good qty', () => {
    const ctx: GateCheckContext = {
      targetStep: { id: 's2', code: 'SEWING', seq: 20, status: 'PENDING', qtyIn: 105 },
      allSteps: [],
      predecessorSteps: [{ id: 's1', code: 'CUTTING', seq: 10, status: 'DONE', qtyGood: 100 }],
    };
    const res = handler.handle(ctx);
    expect(res.passed).toBe(false);
    expect(res.ruleId).toBe('BR-08');
    expect(res.reason).toContain("exceeds previous step's good quantity");
  });
});

describe('EvidencePresentGateHandler (BR-15)', () => {
  const handler = new EvidencePresentGateHandler();

  it('passes when requiresEvidence is false or undefined', () => {
    const ctx: GateCheckContext = {
      targetStep: { id: 's1', code: 'SEWING', seq: 20, status: 'PENDING', requiresEvidence: false },
      allSteps: [],
      predecessorSteps: [],
      evidenceCount: 0,
    };
    const res = handler.handle(ctx);
    expect(res.passed).toBe(true);
  });

  it('BR-15: blocks when requiresEvidence is true and evidenceCount is 0', () => {
    const ctx: GateCheckContext = {
      targetStep: { id: 's1', code: 'WASHING', seq: 30, status: 'PENDING', requiresEvidence: true },
      allSteps: [],
      predecessorSteps: [],
      evidenceCount: 0,
    };
    const res = handler.handle(ctx);
    expect(res.passed).toBe(false);
    expect(res.ruleId).toBe('BR-15');
    expect(res.reason).toContain('requires at least 1 evidence attachment');
  });

  it('passes when requiresEvidence is true and evidenceCount >= 1', () => {
    const ctx: GateCheckContext = {
      targetStep: { id: 's1', code: 'WASHING', seq: 30, status: 'PENDING', requiresEvidence: true },
      allSteps: [],
      predecessorSteps: [],
      evidenceCount: 2,
    };
    const res = handler.handle(ctx);
    expect(res.passed).toBe(true);
  });
});

describe('QcPassedGateHandler (BR-10 / BR-19)', () => {
  const handler = new QcPassedGateHandler();

  it('passes when predecessor does not require QC', () => {
    const ctx: GateCheckContext = {
      targetStep: { id: 's2', code: 'SEWING', seq: 20, status: 'PENDING' },
      allSteps: [],
      predecessorSteps: [{ id: 's1', code: 'CUTTING', seq: 10, status: 'DONE', requiresQc: false }],
    };
    const res = handler.handle(ctx);
    expect(res.passed).toBe(true);
  });

  it('BR-10: blocks when predecessor requires QC and qcPassed is false', () => {
    const ctx: GateCheckContext = {
      targetStep: { id: 's2', code: 'WASHING', seq: 30, status: 'PENDING' },
      allSteps: [],
      predecessorSteps: [
        { id: 's1', code: 'SEWING', seq: 20, status: 'DONE', requiresQc: true, qcPassed: false },
      ],
    };
    const res = handler.handle(ctx);
    expect(res.passed).toBe(false);
    expect(res.ruleId).toBe('BR-10');
    expect(res.reason).toContain('did not pass QC inspection');
  });

  it('passes when predecessor requires QC and qcPassed is true', () => {
    const ctx: GateCheckContext = {
      targetStep: { id: 's2', code: 'WASHING', seq: 30, status: 'PENDING' },
      allSteps: [],
      predecessorSteps: [
        { id: 's1', code: 'SEWING', seq: 20, status: 'DONE', requiresQc: true, qcPassed: true },
      ],
    };
    const res = handler.handle(ctx);
    expect(res.passed).toBe(true);
  });
});

describe('Chain of Responsibility order and evaluateStepGates', () => {
  it('stops at the first failing gate in order: BR-14 before BR-06', () => {
    const chain = createDefaultGateChain();
    // Step is CUTTING, predecessor is not done AND fabric allocation is 0
    const ctx: GateCheckContext = {
      targetStep: { id: 's2', code: 'CUTTING', seq: 10, status: 'PENDING' },
      allSteps: [],
      predecessorSteps: [{ id: 's1', code: 'FABRIC_INSPECT', seq: 5, status: 'IN_PROGRESS' }],
      fabricBomLine: { requiredQty: 100, allocatedQty: 0 },
    };
    const res = evaluateStepGates(ctx, chain);
    // Should fail with BR-14 (predecessor not done) rather than BR-06
    expect(res.passed).toBe(false);
    expect(res.ruleId).toBe('BR-14');
  });

  it('evaluates next handler when previous handler passes', () => {
    const chain = createDefaultGateChain();
    // Predecessor is DONE, but fabric is not allocated -> fails at BR-06
    const ctx: GateCheckContext = {
      targetStep: { id: 's2', code: 'CUTTING', seq: 10, status: 'PENDING' },
      allSteps: [],
      predecessorSteps: [{ id: 's1', code: 'FABRIC_INSPECT', seq: 5, status: 'DONE' }],
      fabricBomLine: { requiredQty: 100, allocatedQty: 50 },
    };
    const res = evaluateStepGates(ctx, chain);
    expect(res.passed).toBe(false);
    expect(res.ruleId).toBe('BR-06');
  });
});

describe('evaluateStepReadiness', () => {
  it('transitions initial steps with no predecessors and satisfied gates to READY', () => {
    const snapshot: WorkflowInstanceSnapshot = {
      steps: [
        { id: 's1', code: 'CUTTING', seq: 10, status: 'PENDING' },
        { id: 's2', code: 'SEWING', seq: 20, status: 'PENDING' },
      ],
      fabricBomLine: { requiredQty: 200, allocatedQty: 200 },
    };

    const out = evaluateStepReadiness(snapshot);
    expect(out.newlyReadyStepCodes).toEqual(['CUTTING']);
    expect(out.changes).toHaveLength(1);
    expect(out.changes[0]).toMatchObject({
      stepId: 's1',
      code: 'CUTTING',
      fromStatus: 'PENDING',
      toStatus: 'READY',
    });
    expect(snapshot.steps.find((s) => s.code === 'CUTTING')?.status).toBe('READY');
    expect(snapshot.steps.find((s) => s.code === 'SEWING')?.status).toBe('PENDING');
  });

  it('marks step with false condition as SKIPPED and allows downstream step to become READY', () => {
    const snapshot: WorkflowInstanceSnapshot = {
      orderConditionContext: {
        orderQuantity: 200,
        washType: 'RAW',
        fabricWeightOz: 12,
        hasRipEffect: false,
        hasEmbroidery: false,
      },
      fabricBomLine: { requiredQty: 100, allocatedQty: 100 },
      steps: [
        { id: 's1', code: 'CUTTING', seq: 10, status: 'DONE', qtyGood: 200 },
        {
          id: 's2',
          code: 'WASHING',
          seq: 20,
          status: 'PENDING',
          conditionExpr: {
            field: 'washType',
            operator: '!=',
            value: 'RAW',
          },
        },
        {
          id: 's3',
          code: 'FINISHING',
          seq: 30,
          status: 'PENDING',
          predecessorIds: ['s2'],
        },
      ],
    };

    const out = evaluateStepReadiness(snapshot);
    expect(out.newlySkippedStepCodes).toContain('WASHING');
    expect(out.newlyReadyStepCodes).toContain('FINISHING');
    expect(snapshot.steps.find((s) => s.code === 'WASHING')?.status).toBe('SKIPPED');
    expect(snapshot.steps.find((s) => s.code === 'FINISHING')?.status).toBe('READY');
  });

  it('BR-14 keeps the step after a skipped one PENDING while the step before the skip is pending', () => {
    const snapshot: WorkflowInstanceSnapshot = {
      steps: [
        { id: 's1', code: 'BOM_ALLOCATE', seq: 3, status: 'DONE' },
        { id: 's2', code: 'CUTTING', seq: 6, status: 'IN_PROGRESS' },
        { id: 's3', code: 'EMBROIDERY', seq: 7, status: 'SKIPPED' },
        { id: 's4', code: 'SEWING', seq: 8, status: 'PENDING' },
      ],
    };

    const out = evaluateStepReadiness(snapshot);
    expect(out.newlyReadyStepCodes).toEqual([]);
    expect(out.evaluations['SEWING']?.ruleId).toBe('BR-14');
    expect(out.evaluations['SEWING']?.reason).toContain('CUTTING');
  });

  it('BR-14 opens the step after a skipped one once the step before the skip is done', () => {
    const snapshot: WorkflowInstanceSnapshot = {
      steps: [
        { id: 's2', code: 'CUTTING', seq: 6, status: 'DONE' },
        { id: 's3', code: 'EMBROIDERY', seq: 7, status: 'SKIPPED' },
        { id: 's4', code: 'SEWING', seq: 8, status: 'PENDING' },
      ],
    };

    expect(evaluateStepReadiness(snapshot).newlyReadyStepCodes).toEqual(['SEWING']);
  });

  it('keeps CUTTING PENDING if fabric is underallocated', () => {
    const snapshot: WorkflowInstanceSnapshot = {
      steps: [{ id: 's1', code: 'CUTTING', seq: 10, status: 'PENDING' }],
      fabricBomLine: { requiredQty: 200, allocatedQty: 50 },
    };

    const out = evaluateStepReadiness(snapshot);
    expect(out.newlyReadyStepCodes).toEqual([]);
    expect(out.evaluations['CUTTING']?.passed).toBe(false);
    expect(out.evaluations['CUTTING']?.ruleId).toBe('BR-06');
    expect(snapshot.steps[0]?.status).toBe('PENDING');
  });
});
