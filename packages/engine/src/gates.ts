import type { ConditionAst, OrderConditionContext } from '@denimflow/shared';
import { evaluateCondition } from './conditions.js';

// Workflow engine: pure TypeScript, no framework, database or I/O imports
// (see .agents/rules/01-architecture-boundaries.md).
// Chain of Responsibility for Step Readiness & Gate evaluation (T4.1, FR-11, BR-06, BR-08, BR-10, BR-14, BR-15, BR-19).

export interface FabricBomLineAllocation {
  requiredQty: number;
  allocatedQty: number;
}

export interface CuttingGateInput {
  fabricBomLine: FabricBomLineAllocation | null;
}

export interface GateResult {
  passed: boolean;
  ruleId?: string;
  reason?: string;
}

export type GateLinkResult = GateResult;

export interface StepInstanceSnapshot {
  id: string;
  code: string;
  name?: string;
  seq: number;
  status: 'PENDING' | 'READY' | 'IN_PROGRESS' | 'WAITING_QC' | 'REWORK' | 'DONE' | 'SKIPPED';
  predecessorIds?: string[];
  isMandatory?: boolean;
  requiresEvidence?: boolean;
  requiresQc?: boolean;
  conditionExpr?: unknown;
  evidenceCount?: number;
  qtyIn?: number;
  qtyGood?: number;
  qtyDefect?: number;
  qcPassed?: boolean;
}

export interface GateCheckContext {
  targetStep: StepInstanceSnapshot;
  allSteps: StepInstanceSnapshot[];
  predecessorSteps: StepInstanceSnapshot[];
  fabricBomLine?: FabricBomLineAllocation | null;
  evidenceCount?: number;
  [key: string]: unknown;
}

/**
 * Handler interface in the Chain of Responsibility.
 * Each link inspects the context and returns pass or block with ruleId.
 */
export interface GateHandler {
  setNext(handler: GateHandler): GateHandler;
  handle(context: GateCheckContext): GateLinkResult;
}

export abstract class AbstractGateHandler implements GateHandler {
  private nextHandler?: GateHandler;

  public setNext(handler: GateHandler): GateHandler {
    this.nextHandler = handler;
    return handler;
  }

  public handle(context: GateCheckContext): GateLinkResult {
    const result = this.check(context);
    if (!result.passed) {
      return result;
    }
    if (this.nextHandler) {
      return this.nextHandler.handle(context);
    }
    return { passed: true };
  }

  protected abstract check(context: GateCheckContext): GateLinkResult;
}

/**
 * 1. Predecessors done (BR-14)
 * A step opens only when all predecessor steps are completed (DONE or SKIPPED).
 */
export class PredecessorsDoneGateHandler extends AbstractGateHandler {
  protected check(context: GateCheckContext): GateLinkResult {
    const { predecessorSteps } = context;

    for (const pred of predecessorSteps) {
      if (pred.status !== 'DONE' && pred.status !== 'SKIPPED') {
        return {
          passed: false,
          ruleId: 'BR-14',
          reason: `BR-14: Predecessor step ${pred.code} is not completed (current status: ${pred.status}).`,
        };
      }
    }

    return { passed: true };
  }
}

/**
 * 2. Materials allocated (BR-06)
 * Before CUTTING can start, fabric must be 100% allocated per BOM.
 */
export class MaterialAllocationGateHandler extends AbstractGateHandler {
  protected check(context: GateCheckContext): GateLinkResult {
    if (context.targetStep.code !== 'CUTTING') {
      return { passed: true };
    }

    const { fabricBomLine } = context;
    if (!fabricBomLine) {
      return {
        passed: false,
        ruleId: 'BR-06',
        reason: 'BR-06: Order does not have a fabric BOM line calculated.',
      };
    }

    const difference = fabricBomLine.requiredQty - fabricBomLine.allocatedQty;
    if (difference > 0.001) {
      return {
        passed: false,
        ruleId: 'BR-06',
        reason: `BR-06: CUTTING may not start unless fabric is fully allocated per the BOM. Required: ${fabricBomLine.requiredQty}, Allocated: ${fabricBomLine.allocatedQty}, Missing: ${Number(difference.toFixed(3))}.`,
      };
    }

    return { passed: true };
  }
}

/**
 * 3. Quantity conservation (BR-08)
 * Quantity entering step <= good quantity of previous step(s).
 */
export class QuantityConservationGateHandler extends AbstractGateHandler {
  protected check(context: GateCheckContext): GateLinkResult {
    const { targetStep, predecessorSteps } = context;

    if (targetStep.qtyIn === undefined || predecessorSteps.length === 0) {
      return { passed: true };
    }

    // Find previous non-skipped predecessor good quantity
    const completedPredecessors = predecessorSteps.filter((p) => p.status === 'DONE');
    if (completedPredecessors.length === 0) {
      return { passed: true };
    }

    const maxPreviousGood = completedPredecessors.reduce(
      (sum, p) => sum + (p.qtyGood !== undefined ? p.qtyGood : 0),
      0,
    );

    if (targetStep.qtyIn > maxPreviousGood) {
      return {
        passed: false,
        ruleId: 'BR-08',
        reason: `BR-08: Quantity entering ${targetStep.code} (${targetStep.qtyIn}) exceeds previous step's good quantity (${maxPreviousGood}).`,
      };
    }

    return { passed: true };
  }
}

/**
 * 4. Evidence present (BR-15)
 * If step requires evidence, it must have at least 1 attachment before completion.
 */
export class EvidencePresentGateHandler extends AbstractGateHandler {
  protected check(context: GateCheckContext): GateLinkResult {
    const { targetStep } = context;

    if (!targetStep.requiresEvidence) {
      return { passed: true };
    }

    const count = context.evidenceCount ?? targetStep.evidenceCount ?? 0;
    if (count < 1) {
      return {
        passed: false,
        ruleId: 'BR-15',
        reason: `BR-15: Step ${targetStep.code} requires at least 1 evidence attachment.`,
      };
    }

    return { passed: true };
  }
}

/**
 * 5. QC passed (BR-10 / BR-19)
 * If previous step required QC, QC inspection must pass before successor opens.
 */
export class QcPassedGateHandler extends AbstractGateHandler {
  protected check(context: GateCheckContext): GateLinkResult {
    const { predecessorSteps } = context;

    for (const pred of predecessorSteps) {
      if (pred.requiresQc && pred.status === 'DONE' && pred.qcPassed === false) {
        return {
          passed: false,
          ruleId: 'BR-10',
          reason: `BR-10: Predecessor step ${pred.code} did not pass QC inspection.`,
        };
      }
    }

    return { passed: true };
  }
}

/**
 * Creates the Gate chain in the order defined in skills/add-engine-rule.md:
 * 1. Predecessors done (BR-14)
 * 2. Materials allocated (BR-06)
 * 3. Quantity conservation (BR-08)
 * 4. Evidence present (BR-15)
 * 5. QC passed (BR-10/BR-19)
 */
export function createDefaultGateChain(): GateHandler {
  const h1 = new PredecessorsDoneGateHandler();
  const h2 = new MaterialAllocationGateHandler();
  const h3 = new QuantityConservationGateHandler();
  const h4 = new EvidencePresentGateHandler();
  const h5 = new QcPassedGateHandler();

  h1.setNext(h2).setNext(h3).setNext(h4).setNext(h5);
  return h1;
}

/**
 * Evaluates all gates for a single step.
 */
export function evaluateStepGates(
  context: GateCheckContext,
  chain: GateHandler = createDefaultGateChain(),
): GateLinkResult {
  return chain.handle(context);
}

/**
 * Standalone backward-compatible helper for BR-06 cutting gate.
 */
export function evaluateCuttingGate(input: CuttingGateInput): GateResult {
  const handler = new MaterialAllocationGateHandler();
  return handler.handle({
    targetStep: { id: 'dummy', code: 'CUTTING', seq: 10, status: 'PENDING' },
    allSteps: [],
    predecessorSteps: [],
    fabricBomLine: input.fabricBomLine,
  });
}

export interface WorkflowInstanceSnapshot {
  steps: StepInstanceSnapshot[];
  orderConditionContext?: OrderConditionContext;
  fabricBomLine?: FabricBomLineAllocation | null;
}

export interface StepReadinessChange {
  stepId: string;
  code: string;
  fromStatus: 'PENDING';
  toStatus: 'READY' | 'SKIPPED';
  reason?: string;
  ruleId?: string;
}

export interface InstanceReadinessOutput {
  changes: StepReadinessChange[];
  newlyReadyStepCodes: string[];
  newlySkippedStepCodes: string[];
  evaluations: Record<string, GateResult>;
}

/**
 * Evaluates readiness across all PENDING steps in an instance snapshot.
 * - If condition evaluates to false -> step becomes SKIPPED.
 * - If predecessors are DONE/SKIPPED and Gate chain passes -> step becomes READY.
 * - If Gate chain blocks -> step remains PENDING with ruleId and reason.
 */
export function evaluateStepReadiness(
  snapshot: WorkflowInstanceSnapshot,
  customChain?: GateHandler,
): InstanceReadinessOutput {
  const chain = customChain ?? createDefaultGateChain();
  const sorted = [...snapshot.steps].sort((a, b) => a.seq - b.seq);
  const stepsById = new Map<string, StepInstanceSnapshot>(sorted.map((s) => [s.id, s]));

  const changes: StepReadinessChange[] = [];
  const newlyReadyStepCodes: string[] = [];
  const newlySkippedStepCodes: string[] = [];
  const evaluations: Record<string, GateResult> = {};

  for (let i = 0; i < sorted.length; i++) {
    const step = sorted[i]!;
    if (step.status !== 'PENDING') {
      continue;
    }

    // Determine predecessors (by explicit IDs or by previous steps in sequence)
    let predecessors: StepInstanceSnapshot[] = [];
    if (step.predecessorIds && step.predecessorIds.length > 0) {
      predecessors = step.predecessorIds
        .map((pid) => stepsById.get(pid))
        .filter((p): p is StepInstanceSnapshot => Boolean(p));
    } else if (i > 0) {
      predecessors = [sorted[i - 1]!];
    }

    // 1. Evaluate condition if present
    if (step.conditionExpr && snapshot.orderConditionContext) {
      try {
        const isEligible = evaluateCondition(
          step.conditionExpr as ConditionAst,
          snapshot.orderConditionContext,
        );
        if (!isEligible) {
          changes.push({
            stepId: step.id,
            code: step.code,
            fromStatus: 'PENDING',
            toStatus: 'SKIPPED',
            reason: `Condition evaluated to false (${JSON.stringify(step.conditionExpr)})`,
          });
          newlySkippedStepCodes.push(step.code);
          evaluations[step.code] = {
            passed: false,
            reason: 'Step condition evaluated to false',
          };
          step.status = 'SKIPPED';
          continue;
        }
      } catch (err) {
        changes.push({
          stepId: step.id,
          code: step.code,
          fromStatus: 'PENDING',
          toStatus: 'SKIPPED',
          reason: err instanceof Error ? err.message : 'Condition evaluation failed',
        });
        newlySkippedStepCodes.push(step.code);
        evaluations[step.code] = {
          passed: false,
          reason: 'Condition evaluation error',
        };
        step.status = 'SKIPPED';
        continue;
      }
    }

    // 2. Evaluate Gate Chain
    const context: GateCheckContext = {
      targetStep: step,
      allSteps: sorted,
      predecessorSteps: predecessors,
      fabricBomLine: snapshot.fabricBomLine,
      evidenceCount: step.evidenceCount,
    };

    const gateResult = chain.handle(context);
    evaluations[step.code] = gateResult;

    if (gateResult.passed) {
      changes.push({
        stepId: step.id,
        code: step.code,
        fromStatus: 'PENDING',
        toStatus: 'READY',
      });
      newlyReadyStepCodes.push(step.code);
      step.status = 'READY';
    }
  }

  return {
    changes,
    newlyReadyStepCodes,
    newlySkippedStepCodes,
    evaluations,
  };
}
