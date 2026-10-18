import type { ConditionAst, OrderConditionContext } from '@denimflow/shared';
import { evaluateCondition } from './conditions.js';

// Workflow engine: pure TypeScript, no framework, database or I/O imports
// (see .agents/rules/01-architecture-boundaries.md).
// Evaluates initial StepInstance states during Order Confirmation snapshot (T3.5, FR-07, FR-11, BR-18).

export interface StepDefinitionSnapshotInput {
  id: string;
  code: string;
  name: string;
  seq: number;
  isStart: boolean;
  isEnd: boolean;
  isMandatory: boolean;
  conditionExpr?: unknown;
}

export interface BuildInstancePlanItem {
  stepDefinitionId: string;
  code: string;
  status: 'DONE' | 'READY' | 'PENDING' | 'SKIPPED';
  isSkipped: boolean;
  skipReason?: string;
}

export interface BuildInstancePlanOutput {
  plan: BuildInstancePlanItem[];
  firstReadyStepCode?: string;
  skippedStepCodes: string[];
}

export function buildWorkflowInstancePlan(
  steps: StepDefinitionSnapshotInput[],
  context: OrderConditionContext,
): BuildInstancePlanOutput {
  const sorted = [...steps].sort((a, b) => a.seq - b.seq);
  const plan: BuildInstancePlanItem[] = [];
  const skippedStepCodes: string[] = [];

  let hasSetReady = false;

  for (const step of sorted) {
    if (step.isStart || step.code === 'ORDER_CONFIRM') {
      plan.push({
        stepDefinitionId: step.id,
        code: step.code,
        status: 'DONE',
        isSkipped: false,
      });
      continue;
    }

    // Evaluate condition if present
    let isEligible = true;
    let skipReason: string | undefined;

    if (step.conditionExpr) {
      try {
        isEligible = evaluateCondition(step.conditionExpr as ConditionAst, context);
        if (!isEligible) {
          skipReason = `Condition evaluated to false (${JSON.stringify(step.conditionExpr)})`;
        }
      } catch (err) {
        isEligible = false;
        skipReason = err instanceof Error ? err.message : 'Condition evaluation failed';
      }
    }

    // BR-18: Clean wash skipped by customer request
    const isSkipCleanWash =
      'order' in context && context.order
        ? Boolean((context.order as Record<string, unknown>).skipCleanWash)
        : Boolean((context as Record<string, unknown>).skipCleanWash);

    if (step.code === 'CLEAN_WASH' && isSkipCleanWash) {
      isEligible = false;
      skipReason = 'BR-18: Clean wash skipped by customer request';
    }

    if (!isEligible) {
      plan.push({
        stepDefinitionId: step.id,
        code: step.code,
        status: 'SKIPPED',
        isSkipped: true,
        skipReason,
      });
      skippedStepCodes.push(step.code);
    } else if (!hasSetReady) {
      plan.push({
        stepDefinitionId: step.id,
        code: step.code,
        status: 'READY',
        isSkipped: false,
      });
      hasSetReady = true;
    } else {
      plan.push({
        stepDefinitionId: step.id,
        code: step.code,
        status: 'PENDING',
        isSkipped: false,
      });
    }
  }

  const firstReady = plan.find((p) => p.status === 'READY');

  return {
    plan,
    firstReadyStepCode: firstReady?.code,
    skippedStepCodes,
  };
}
