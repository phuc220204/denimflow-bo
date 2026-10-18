import { describe, expect, it } from 'vitest';
import type { OrderConditionContext } from '@denimflow/shared';
import { buildWorkflowInstancePlan, type StepDefinitionSnapshotInput } from './instance-builder.js';

describe('buildWorkflowInstancePlan (T3.5, FR-07, BR-18 Snapshot)', () => {
  const steps: StepDefinitionSnapshotInput[] = [
    {
      id: 'step-1',
      code: 'ORDER_CONFIRM',
      name: 'Order intake and confirmation',
      seq: 1,
      isStart: true,
      isEnd: false,
      isMandatory: true,
    },
    {
      id: 'step-2',
      code: 'FABRIC_COLOR_SELECT',
      name: 'Fabric and color selection',
      seq: 2,
      isStart: false,
      isEnd: false,
      isMandatory: true,
    },
    {
      id: 'step-3',
      code: 'FABRIC_INSPECT',
      name: 'Incoming fabric inspection',
      seq: 3,
      isStart: false,
      isEnd: false,
      isMandatory: false,
      conditionExpr: { op: 'eq', field: 'order.fabricInspectRequired', value: true },
    },
    {
      id: 'step-4',
      code: 'CUTTING',
      name: 'Cutting',
      seq: 4,
      isStart: false,
      isEnd: false,
      isMandatory: true,
    },
    {
      id: 'step-5',
      code: 'CLEAN_WASH',
      name: 'Clean wash',
      seq: 5,
      isStart: false,
      isEnd: false,
      isMandatory: false,
      conditionExpr: {
        op: 'not',
        arg: { op: 'eq', field: 'order.skipCleanWash', value: true },
      },
    },
    {
      id: 'step-6',
      code: 'FINAL_QC',
      name: 'Final QC',
      seq: 6,
      isStart: false,
      isEnd: true,
      isMandatory: true,
    },
  ];

  it('marks ORDER_CONFIRM as DONE, first eligible step as READY, and remainder as PENDING when conditions match', () => {
    const context: OrderConditionContext = {
      order: {
        fabricInspectRequired: true,
        skipCleanWash: false,
      },
    };

    const result = buildWorkflowInstancePlan(steps, context);

    expect(result.firstReadyStepCode).toBe('FABRIC_COLOR_SELECT');
    expect(result.skippedStepCodes).toEqual([]);

    const orderConfirm = result.plan.find((p) => p.code === 'ORDER_CONFIRM');
    expect(orderConfirm?.status).toBe('DONE');

    const fcSelect = result.plan.find((p) => p.code === 'FABRIC_COLOR_SELECT');
    expect(fcSelect?.status).toBe('READY');

    const inspect = result.plan.find((p) => p.code === 'FABRIC_INSPECT');
    expect(inspect?.status).toBe('PENDING');

    const cutting = result.plan.find((p) => p.code === 'CUTTING');
    expect(cutting?.status).toBe('PENDING');
  });

  it('evaluates false condition as SKIPPED', () => {
    const context: OrderConditionContext = {
      order: {
        fabricInspectRequired: false, // Condition will fail
        skipCleanWash: false,
      },
    };

    const result = buildWorkflowInstancePlan(steps, context);

    const inspect = result.plan.find((p) => p.code === 'FABRIC_INSPECT');
    expect(inspect?.status).toBe('SKIPPED');
    expect(result.skippedStepCodes).toContain('FABRIC_INSPECT');
  });

  it('BR-18: marks CLEAN_WASH as SKIPPED when skipCleanWash = true', () => {
    const context: OrderConditionContext = {
      order: {
        fabricInspectRequired: true,
        skipCleanWash: true,
      },
    };

    const result = buildWorkflowInstancePlan(steps, context);

    const cleanWash = result.plan.find((p) => p.code === 'CLEAN_WASH');
    expect(cleanWash?.status).toBe('SKIPPED');
    expect(result.skippedStepCodes).toContain('CLEAN_WASH');
  });
});
