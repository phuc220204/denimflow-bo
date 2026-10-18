// Workflow engine: pure TypeScript, no framework, database or I/O imports
// (see .agents/rules/01-architecture-boundaries.md).
// Template validation implementing BR-01 (T2.3, FR-05).

export interface WorkflowStepDefinition {
  id: string;
  code: string;
  name?: string;
  stepType?: string;
  seq?: number;
  isStart?: boolean;
  isEnd?: boolean;
  maxRework?: number | null;
  [key: string]: unknown;
}

export interface WorkflowStepTransition {
  id?: string;
  fromStepId: string;
  toStepId: string;
  kind?: 'NORMAL' | 'REWORK';
  [key: string]: unknown;
}

export interface WorkflowTemplateDefinition {
  id?: string;
  name?: string;
  steps: WorkflowStepDefinition[];
  transitions: WorkflowStepTransition[];
}

export type TemplateViolationCode =
  | 'NO_START_STEP'
  | 'MULTIPLE_START_STEPS'
  | 'NO_END_STEP'
  | 'ORPHAN_STEP'
  | 'CANNOT_REACH_END'
  | 'MISSING_MAX_REWORK'
  | 'UNBOUNDED_CYCLE'
  | 'INVALID_TRANSITION_STEP';

export interface TemplateViolation {
  code: TemplateViolationCode;
  message: string;
  stepId?: string;
  stepCode?: string;
  details?: Record<string, unknown>;
}

export interface TemplateValidationResult {
  valid: boolean;
  violations: TemplateViolation[];
}

/**
 * Validates a workflow template against BR-01:
 * - Exactly one start step
 * - >= 1 end step
 * - Every step is reachable from the start step (no orphan steps)
 * - Every step has a path to an end step (no dead ends)
 * - Every REWORK transition has a valid maxRework limit (> 0) on the target step
 * - No unbounded cycles in normal transitions
 */
export function validateTemplate(template: WorkflowTemplateDefinition): TemplateValidationResult {
  const violations: TemplateViolation[] = [];
  const { steps, transitions } = template;

  const stepMap = new Map<string, WorkflowStepDefinition>(steps.map((s) => [s.id, s]));

  // 1. Validate Start Step(s)
  const startSteps = steps.filter((s) => Boolean(s.isStart));
  if (startSteps.length === 0) {
    violations.push({
      code: 'NO_START_STEP',
      message: 'Workflow template must have exactly one start step (none found).',
    });
  } else if (startSteps.length > 1) {
    for (const startStep of startSteps) {
      violations.push({
        code: 'MULTIPLE_START_STEPS',
        message: `Multiple start steps found. Step "${startStep.code}" (${startStep.id}) is marked as start.`,
        stepId: startStep.id,
        stepCode: startStep.code,
      });
    }
  }

  // 2. Validate End Step(s)
  const endSteps = steps.filter((s) => Boolean(s.isEnd));
  if (endSteps.length === 0) {
    violations.push({
      code: 'NO_END_STEP',
      message: 'Workflow template must have at least one end step.',
    });
  }

  // 3. Validate Transition endpoints reference existing steps
  const validTransitions: WorkflowStepTransition[] = [];
  for (const t of transitions) {
    const fromExists = stepMap.has(t.fromStepId);
    const toExists = stepMap.has(t.toStepId);

    if (!fromExists) {
      violations.push({
        code: 'INVALID_TRANSITION_STEP',
        message: `Transition references nonexistent source step id: "${t.fromStepId}".`,
        details: { transition: t },
      });
    }
    if (!toExists) {
      violations.push({
        code: 'INVALID_TRANSITION_STEP',
        message: `Transition references nonexistent target step id: "${t.toStepId}".`,
        details: { transition: t },
      });
    }

    if (fromExists && toExists) {
      validTransitions.push(t);
    }
  }

  // 4. Validate REWORK transitions have maxRework limit on target step
  for (const t of validTransitions) {
    if (t.kind === 'REWORK') {
      const target = stepMap.get(t.toStepId);
      if (!target || target.maxRework == null || target.maxRework <= 0) {
        violations.push({
          code: 'MISSING_MAX_REWORK',
          message: `Rework transition to "${target?.code ?? t.toStepId}" requires target step to define maxRework > 0.`,
          stepId: target?.id ?? t.toStepId,
          stepCode: target?.code,
          details: { transition: t },
        });
      }
    }
  }

  // Build Adjacency Lists
  // Forward graph (all valid transitions)
  const forwardAdj = new Map<string, string[]>();
  // Normal transitions only (for unbounded cycle detection)
  const normalForwardAdj = new Map<string, string[]>();
  // Reverse graph (all valid transitions)
  const reverseAdj = new Map<string, string[]>();

  for (const s of steps) {
    forwardAdj.set(s.id, []);
    normalForwardAdj.set(s.id, []);
    reverseAdj.set(s.id, []);
  }

  for (const t of validTransitions) {
    forwardAdj.get(t.fromStepId)?.push(t.toStepId);
    reverseAdj.get(t.toStepId)?.push(t.fromStepId);

    if (t.kind !== 'REWORK') {
      normalForwardAdj.get(t.fromStepId)?.push(t.toStepId);
    }
  }

  // 5. Reachability from Start Step (No orphan steps)
  if (startSteps.length > 0) {
    const visitedFromStart = new Set<string>();
    const queue: string[] = startSteps.map((s) => s.id);
    for (const id of queue) {
      visitedFromStart.add(id);
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      const neighbors = forwardAdj.get(current) ?? [];
      for (const next of neighbors) {
        if (!visitedFromStart.has(next)) {
          visitedFromStart.add(next);
          queue.push(next);
        }
      }
    }

    for (const step of steps) {
      if (!visitedFromStart.has(step.id)) {
        violations.push({
          code: 'ORPHAN_STEP',
          message: `Step "${step.code}" is not reachable from the start step.`,
          stepId: step.id,
          stepCode: step.code,
        });
      }
    }
  }

  // 6. Reachability to End Step (Every step reaches at least one end step)
  if (endSteps.length > 0) {
    const canReachEnd = new Set<string>();
    const queue: string[] = endSteps.map((s) => s.id);
    for (const id of queue) {
      canReachEnd.add(id);
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      const predecessors = reverseAdj.get(current) ?? [];
      for (const prev of predecessors) {
        if (!canReachEnd.has(prev)) {
          canReachEnd.add(prev);
          queue.push(prev);
        }
      }
    }

    for (const step of steps) {
      if (!canReachEnd.has(step.id)) {
        violations.push({
          code: 'CANNOT_REACH_END',
          message: `Step "${step.code}" has no path reaching an end step.`,
          stepId: step.id,
          stepCode: step.code,
        });
      }
    }
  }

  // 7. Unbounded cycle detection (Cycles in normal transitions)
  // DFS 3-color graph traversal: 0 = unvisited (white), 1 = visiting (gray), 2 = visited (black)
  const color = new Map<string, number>();
  const parent = new Map<string, string>();
  for (const s of steps) {
    color.set(s.id, 0);
  }

  function dfsCycle(nodeId: string, path: string[]): boolean {
    color.set(nodeId, 1);
    path.push(nodeId);

    const neighbors = normalForwardAdj.get(nodeId) ?? [];
    for (const next of neighbors) {
      const nextColor = color.get(next) ?? 0;
      if (nextColor === 1) {
        // Back-edge found -> cycle!
        const cycleStartIndex = path.indexOf(next);
        const cycleSteps = path.slice(cycleStartIndex);
        const cycleCodes = cycleSteps
          .map((id) => stepMap.get(id)?.code ?? id)
          .concat([stepMap.get(next)?.code ?? next]);

        violations.push({
          code: 'UNBOUNDED_CYCLE',
          message: `Unbounded cycle detected in normal transitions: ${cycleCodes.join(' -> ')}.`,
          stepId: next,
          stepCode: stepMap.get(next)?.code,
          details: { cycleSteps },
        });
        return true;
      }
      if (nextColor === 0) {
        parent.set(next, nodeId);
        if (dfsCycle(next, path)) {
          return true;
        }
      }
    }

    path.pop();
    color.set(nodeId, 2);
    return false;
  }

  for (const s of steps) {
    if ((color.get(s.id) ?? 0) === 0) {
      dfsCycle(s.id, []);
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}
