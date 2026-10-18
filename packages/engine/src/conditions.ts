import type {
  AndConditionAst,
  ConditionAst,
  ConditionOperator,
  EqConditionAst,
  NeqConditionAst,
  NotConditionAst,
  OrConditionAst,
  OrderConditionContext,
} from '@denimflow/shared';

// Workflow engine: pure TypeScript, no framework, database or I/O imports
// (see .agents/rules/01-architecture-boundaries.md).
// Evaluates workflow condition expressions using the Strategy Pattern (T2.2, FR-04).

export class UnsupportedOperatorError extends Error {
  public readonly operator: string;

  constructor(operator: string) {
    super(`Unsupported condition operator: "${operator}"`);
    this.name = 'UnsupportedOperatorError';
    this.operator = operator;
  }
}

/**
 * Strategy interface for evaluating an AST condition operator.
 */
export interface ConditionStrategy<T = ConditionAst> {
  evaluate(
    node: T,
    context: OrderConditionContext,
    evaluateChild: (child: ConditionAst) => boolean,
  ): boolean;
}

/**
 * Extracts property value from OrderConditionContext.
 * Supports:
 * - Direct match: context['order.dyeRequired']
 * - Nested object: context.order.dyeRequired
 * - Flat object: context.dyeRequired
 * Returns `null` if the property is missing or undefined (normalizes to JSON/SQL null).
 */
export function resolveContextValue(field: string, context: OrderConditionContext): unknown {
  if (!context || typeof context !== 'object') {
    return null;
  }

  const ctxObj = context as Record<string, unknown>;

  // 1. Exact match e.g. context['order.washTypeId']
  if (field in ctxObj) {
    const val = ctxObj[field];
    return val === undefined ? null : val;
  }

  // Strip 'order.' prefix to inspect nested or flat properties
  const prop = field.startsWith('order.') ? field.slice('order.'.length) : field;

  // 2. Nested under context.order e.g. context.order.washTypeId
  if (
    'order' in ctxObj &&
    ctxObj['order'] &&
    typeof ctxObj['order'] === 'object' &&
    prop in (ctxObj['order'] as Record<string, unknown>)
  ) {
    const val = (ctxObj['order'] as Record<string, unknown>)[prop];
    return val === undefined ? null : val;
  }

  // 3. Flat property on context e.g. context.washTypeId
  if (prop in ctxObj) {
    const val = ctxObj[prop];
    return val === undefined ? null : val;
  }

  return null;
}

/**
 * Strategy for Equality operator ('eq').
 */
export class EqStrategy implements ConditionStrategy<EqConditionAst> {
  evaluate(node: EqConditionAst, context: OrderConditionContext): boolean {
    const actual = resolveContextValue(node.field, context);
    return actual === node.value;
  }
}

/**
 * Strategy for Inequality operator ('neq').
 */
export class NeqStrategy implements ConditionStrategy<NeqConditionAst> {
  evaluate(node: NeqConditionAst, context: OrderConditionContext): boolean {
    const actual = resolveContextValue(node.field, context);
    return actual !== node.value;
  }
}

/**
 * Strategy for Logical AND operator ('and').
 */
export class AndStrategy implements ConditionStrategy<AndConditionAst> {
  evaluate(
    node: AndConditionAst,
    _context: OrderConditionContext,
    evaluateChild: (child: ConditionAst) => boolean,
  ): boolean {
    if (!node.args || node.args.length === 0) {
      return true;
    }
    return node.args.every((child) => evaluateChild(child));
  }
}

/**
 * Strategy for Logical OR operator ('or').
 */
export class OrStrategy implements ConditionStrategy<OrConditionAst> {
  evaluate(
    node: OrConditionAst,
    _context: OrderConditionContext,
    evaluateChild: (child: ConditionAst) => boolean,
  ): boolean {
    if (!node.args || node.args.length === 0) {
      return false;
    }
    return node.args.some((child) => evaluateChild(child));
  }
}

/**
 * Strategy for Logical NOT operator ('not').
 */
export class NotStrategy implements ConditionStrategy<NotConditionAst> {
  evaluate(
    node: NotConditionAst,
    _context: OrderConditionContext,
    evaluateChild: (child: ConditionAst) => boolean,
  ): boolean {
    return !evaluateChild(node.arg);
  }
}

/**
 * ConditionEvaluator registry and evaluator executing strategies per AST node operator.
 */
export class ConditionEvaluator {
  private readonly strategies = new Map<string, ConditionStrategy<ConditionAst>>();

  constructor() {
    this.registerStrategy('eq', new EqStrategy() as ConditionStrategy<ConditionAst>);
    this.registerStrategy('neq', new NeqStrategy() as ConditionStrategy<ConditionAst>);
    this.registerStrategy('and', new AndStrategy() as ConditionStrategy<ConditionAst>);
    this.registerStrategy('or', new OrStrategy() as ConditionStrategy<ConditionAst>);
    this.registerStrategy('not', new NotStrategy() as ConditionStrategy<ConditionAst>);
  }

  public registerStrategy<T = ConditionAst>(
    op: ConditionOperator | string,
    strategy: ConditionStrategy<T>,
  ): this {
    this.strategies.set(op, strategy as unknown as ConditionStrategy<ConditionAst>);
    return this;
  }

  public getStrategy(op: string): ConditionStrategy<ConditionAst> | undefined {
    return this.strategies.get(op);
  }

  /**
   * Evaluates an AST condition node against an order context.
   * If condition is null or undefined, returns `true` (unconditional step always executes).
   */
  public evaluate(
    condition: ConditionAst | null | undefined,
    context: OrderConditionContext,
  ): boolean {
    if (condition === null || condition === undefined) {
      return true;
    }

    const strategy = this.strategies.get(condition.op);
    if (!strategy) {
      throw new UnsupportedOperatorError(condition.op);
    }

    return strategy.evaluate(condition, context, (child) => this.evaluate(child, context));
  }
}

export const defaultConditionEvaluator = new ConditionEvaluator();

export function evaluateCondition(
  condition: ConditionAst | null | undefined,
  context: OrderConditionContext,
): boolean {
  return defaultConditionEvaluator.evaluate(condition, context);
}
