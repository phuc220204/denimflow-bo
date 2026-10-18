import { describe, expect, it } from 'vitest';
import type { ConditionAst, OrderConditionContext } from '@denimflow/shared';
import {
  ConditionEvaluator,
  evaluateCondition,
  resolveContextValue,
  UnsupportedOperatorError,
} from './conditions.js';

describe('Condition Evaluator (Strategy Pattern - T2.2, FR-04)', () => {
  describe('resolveContextValue', () => {
    it('resolves value from nested order object', () => {
      const context: OrderConditionContext = {
        order: { dyeRequired: true, washTypeId: 'WT-01' },
      };
      expect(resolveContextValue('order.dyeRequired', context)).toBe(true);
      expect(resolveContextValue('order.washTypeId', context)).toBe('WT-01');
      expect(resolveContextValue('washTypeId', context)).toBe('WT-01');
    });

    it('resolves value from flat context object', () => {
      const context: OrderConditionContext = {
        dyeRequired: false,
        washTypeId: 'WT-02',
      };
      expect(resolveContextValue('order.dyeRequired', context)).toBe(false);
      expect(resolveContextValue('dyeRequired', context)).toBe(false);
      expect(resolveContextValue('order.washTypeId', context)).toBe('WT-02');
    });

    it('normalizes missing or undefined fields to null', () => {
      const context: OrderConditionContext = { order: { styleId: 'ST-01' } };
      expect(resolveContextValue('order.washTypeId', context)).toBeNull();
      expect(resolveContextValue('order.unknownField', context)).toBeNull();
      expect(resolveContextValue('order.washTypeId', {})).toBeNull();
      expect(
        resolveContextValue('order.washTypeId', null as unknown as OrderConditionContext),
      ).toBeNull();
    });
  });

  describe('Unconditional evaluation (null or undefined AST)', () => {
    it('returns true when condition is null (step always executes)', () => {
      expect(evaluateCondition(null, {})).toBe(true);
    });

    it('returns true when condition is undefined (step always executes)', () => {
      expect(evaluateCondition(undefined, {})).toBe(true);
    });
  });

  describe('eq strategy', () => {
    const cases: Array<{
      title: string;
      ast: ConditionAst;
      context: OrderConditionContext;
      expected: boolean;
    }> = [
      {
        title: 'matches boolean true when field is true',
        ast: { op: 'eq', field: 'order.dyeRequired', value: true },
        context: { order: { dyeRequired: true } },
        expected: true,
      },
      {
        title: 'returns false when boolean field is false but value is true',
        ast: { op: 'eq', field: 'order.dyeRequired', value: true },
        context: { order: { dyeRequired: false } },
        expected: false,
      },
      {
        title: 'matches string enum literal',
        ast: { op: 'eq', field: 'order.dyeMode', value: 'TOTAL' },
        context: { order: { dyeMode: 'TOTAL' } },
        expected: true,
      },
      {
        title: 'returns false when string literal does not match',
        ast: { op: 'eq', field: 'order.dyeMode', value: 'TOTAL' },
        context: { order: { dyeMode: 'PARTIAL' } },
        expected: false,
      },
      {
        title: 'matches null value when context field is null',
        ast: { op: 'eq', field: 'order.washTypeId', value: null },
        context: { order: { washTypeId: null } },
        expected: true,
      },
      {
        title: 'matches null value when context field is omitted',
        ast: { op: 'eq', field: 'order.washTypeId', value: null },
        context: {},
        expected: true,
      },
      {
        title: 'returns false when null expected but string is present',
        ast: { op: 'eq', field: 'order.washTypeId', value: null },
        context: { order: { washTypeId: 'WT-01' } },
        expected: false,
      },
    ];

    cases.forEach(({ title, ast, context, expected }) => {
      it(title, () => {
        expect(evaluateCondition(ast, context)).toBe(expected);
      });
    });
  });

  describe('neq strategy', () => {
    const cases: Array<{
      title: string;
      ast: ConditionAst;
      context: OrderConditionContext;
      expected: boolean;
    }> = [
      {
        title: 'EFFECT_WASH runs when washTypeId is set (neq null)',
        ast: { op: 'neq', field: 'order.washTypeId', value: null },
        context: { order: { washTypeId: 'STONE_WASH' } },
        expected: true,
      },
      {
        title: 'EFFECT_WASH does not run when washTypeId is null',
        ast: { op: 'neq', field: 'order.washTypeId', value: null },
        context: { order: { washTypeId: null } },
        expected: false,
      },
      {
        title: 'EFFECT_WASH does not run when washTypeId is omitted from context',
        ast: { op: 'neq', field: 'order.washTypeId', value: null },
        context: {},
        expected: false,
      },
      {
        title: 'neq returns false when boolean values match',
        ast: { op: 'neq', field: 'order.isCustom', value: true },
        context: { order: { isCustom: true } },
        expected: false,
      },
      {
        title: 'neq returns true when boolean values differ',
        ast: { op: 'neq', field: 'order.isCustom', value: true },
        context: { order: { isCustom: false } },
        expected: true,
      },
    ];

    cases.forEach(({ title, ast, context, expected }) => {
      it(title, () => {
        expect(evaluateCondition(ast, context)).toBe(expected);
      });
    });
  });

  describe('not strategy', () => {
    it('CLEAN_WASH runs when NOT skipCleanWash (skipCleanWash is false)', () => {
      const ast: ConditionAst = {
        op: 'not',
        arg: { op: 'eq', field: 'order.skipCleanWash', value: true },
      };
      expect(evaluateCondition(ast, { order: { skipCleanWash: false } })).toBe(true);
    });

    it('CLEAN_WASH is skipped when skipCleanWash is true', () => {
      const ast: ConditionAst = {
        op: 'not',
        arg: { op: 'eq', field: 'order.skipCleanWash', value: true },
      };
      expect(evaluateCondition(ast, { order: { skipCleanWash: true } })).toBe(false);
    });

    it('CLEAN_WASH runs when skipCleanWash is omitted (defaults to not true)', () => {
      const ast: ConditionAst = {
        op: 'not',
        arg: { op: 'eq', field: 'order.skipCleanWash', value: true },
      };
      expect(evaluateCondition(ast, {})).toBe(true);
    });
  });

  describe('and strategy', () => {
    it('returns true when all operands evaluate to true', () => {
      const ast: ConditionAst = {
        op: 'and',
        args: [
          { op: 'eq', field: 'order.dyeRequired', value: true },
          { op: 'neq', field: 'order.washTypeId', value: null },
        ],
      };
      const context: OrderConditionContext = {
        order: { dyeRequired: true, washTypeId: 'BLEACH' },
      };
      expect(evaluateCondition(ast, context)).toBe(true);
    });

    it('returns false when at least one operand evaluates to false', () => {
      const ast: ConditionAst = {
        op: 'and',
        args: [
          { op: 'eq', field: 'order.dyeRequired', value: true },
          { op: 'neq', field: 'order.washTypeId', value: null },
        ],
      };
      const context: OrderConditionContext = {
        order: { dyeRequired: true, washTypeId: null },
      };
      expect(evaluateCondition(ast, context)).toBe(false);
    });

    it('returns true for empty args list', () => {
      const ast: ConditionAst = { op: 'and', args: [] };
      expect(evaluateCondition(ast, {})).toBe(true);
    });
  });

  describe('or strategy', () => {
    it('returns true when at least one operand evaluates to true', () => {
      const ast: ConditionAst = {
        op: 'or',
        args: [
          { op: 'eq', field: 'order.embroideryRequired', value: true },
          { op: 'eq', field: 'order.isCustom', value: true },
        ],
      };
      expect(
        evaluateCondition(ast, {
          order: { embroideryRequired: true, isCustom: false },
        }),
      ).toBe(true);
      expect(
        evaluateCondition(ast, {
          order: { embroideryRequired: false, isCustom: true },
        }),
      ).toBe(true);
    });

    it('returns false when all operands evaluate to false', () => {
      const ast: ConditionAst = {
        op: 'or',
        args: [
          { op: 'eq', field: 'order.embroideryRequired', value: true },
          { op: 'eq', field: 'order.isCustom', value: true },
        ],
      };
      expect(
        evaluateCondition(ast, {
          order: { embroideryRequired: false, isCustom: false },
        }),
      ).toBe(false);
    });

    it('returns false for empty args list', () => {
      const ast: ConditionAst = { op: 'or', args: [] };
      expect(evaluateCondition(ast, {})).toBe(false);
    });
  });

  describe('nesting and complex business expressions', () => {
    it('evaluates nested (NOT skipCleanWash) AND (dyeRequired OR washTypeId != null)', () => {
      const ast: ConditionAst = {
        op: 'and',
        args: [
          {
            op: 'not',
            arg: { op: 'eq', field: 'order.skipCleanWash', value: true },
          },
          {
            op: 'or',
            args: [
              { op: 'eq', field: 'order.dyeRequired', value: true },
              { op: 'neq', field: 'order.washTypeId', value: null },
            ],
          },
        ],
      };

      // Case 1: skipCleanWash = false, dyeRequired = true -> true
      expect(
        evaluateCondition(ast, {
          order: { skipCleanWash: false, dyeRequired: true, washTypeId: null },
        }),
      ).toBe(true);

      // Case 2: skipCleanWash = true -> false (because of NOT skipCleanWash)
      expect(
        evaluateCondition(ast, {
          order: { skipCleanWash: true, dyeRequired: true, washTypeId: 'ACID' },
        }),
      ).toBe(false);

      // Case 3: skipCleanWash = false, dyeRequired = false, washTypeId = null -> false (OR failed)
      expect(
        evaluateCondition(ast, {
          order: { skipCleanWash: false, dyeRequired: false, washTypeId: null },
        }),
      ).toBe(false);

      // Case 4: skipCleanWash = false, washTypeId = 'ACID' -> true (OR passed)
      expect(
        evaluateCondition(ast, {
          order: { skipCleanWash: false, dyeRequired: false, washTypeId: 'ACID' },
        }),
      ).toBe(true);
    });

    it('evaluates standard workflow step conditions from BUSINESS_RECONCILIATION §3', () => {
      // DYEING step: dyeRequired
      const dyeingCondition: ConditionAst = {
        op: 'eq',
        field: 'order.dyeRequired',
        value: true,
      };
      expect(evaluateCondition(dyeingCondition, { order: { dyeRequired: true } })).toBe(true);
      expect(evaluateCondition(dyeingCondition, { order: { dyeRequired: false } })).toBe(false);

      // EMBROIDERY step: embroideryRequired
      const embroideryCondition: ConditionAst = {
        op: 'eq',
        field: 'order.embroideryRequired',
        value: true,
      };
      expect(evaluateCondition(embroideryCondition, { order: { embroideryRequired: true } })).toBe(
        true,
      );

      // FABRIC_INSPECT step: fabricInspectRequired
      const fabricInspectCondition: ConditionAst = {
        op: 'eq',
        field: 'order.fabricInspectRequired',
        value: true,
      };
      expect(
        evaluateCondition(fabricInspectCondition, { order: { fabricInspectRequired: true } }),
      ).toBe(true);

      // PP_SAMPLE step: ppSampleRequired
      const ppSampleCondition: ConditionAst = {
        op: 'eq',
        field: 'order.ppSampleRequired',
        value: true,
      };
      expect(evaluateCondition(ppSampleCondition, { order: { ppSampleRequired: true } })).toBe(
        true,
      );
    });
  });

  describe('Extensibility and error handling (Strategy Pattern)', () => {
    it('throws UnsupportedOperatorError when an unknown operator is encountered', () => {
      const badAst = {
        op: 'custom_op',
        field: 'order.dyeRequired',
        value: true,
      } as unknown as ConditionAst;
      expect(() => evaluateCondition(badAst, {})).toThrow(UnsupportedOperatorError);
      expect(() => evaluateCondition(badAst, {})).toThrow(
        'Unsupported condition operator: "custom_op"',
      );
    });

    it('allows registering a custom strategy dynamically on ConditionEvaluator', () => {
      interface CustomContainsAst {
        op: 'contains';
        field: string;
        value: string;
      }

      const evaluator = new ConditionEvaluator();
      evaluator.registerStrategy<CustomContainsAst>('contains', {
        evaluate(node: CustomContainsAst, context: OrderConditionContext) {
          const val = String(resolveContextValue(node.field, context) ?? '');
          return val.includes(String(node.value));
        },
      });

      const customAst: CustomContainsAst = {
        op: 'contains',
        field: 'order.orderNumber',
        value: '2026',
      };

      expect(
        evaluator.evaluate(customAst as unknown as ConditionAst, {
          order: { orderNumber: 'PO-2026-0001' },
        }),
      ).toBe(true);
      expect(
        evaluator.evaluate(customAst as unknown as ConditionAst, {
          order: { orderNumber: 'PO-2025-0099' },
        }),
      ).toBe(false);
    });
  });
});
