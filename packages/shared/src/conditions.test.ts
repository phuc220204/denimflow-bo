import { describe, expect, it } from 'vitest';
import {
  conditionAstSchema,
  nullableConditionAstSchema,
  ORDER_CONDITION_FIELDS,
  orderConditionFieldSchema,
} from './conditions.js';

describe('Condition AST Schema (FR-04)', () => {
  describe('leaf conditions (eq, neq)', () => {
    it('accepts valid eq condition with order.* prefix', () => {
      const ast = {
        op: 'eq',
        field: 'order.dyeRequired',
        value: true,
      };
      const parsed = conditionAstSchema.parse(ast);
      expect(parsed).toEqual(ast);
    });

    it('accepts valid eq condition with short field name', () => {
      const ast = {
        op: 'eq',
        field: 'dyeRequired',
        value: true,
      };
      const parsed = conditionAstSchema.parse(ast);
      expect(parsed).toEqual(ast);
    });

    it('accepts valid neq condition with null value (BR-02 washTypeId is set)', () => {
      const ast = {
        op: 'neq',
        field: 'order.washTypeId',
        value: null,
      };
      const parsed = conditionAstSchema.parse(ast);
      expect(parsed).toEqual(ast);
    });

    it('accepts eq condition comparing string or number literals', () => {
      expect(
        conditionAstSchema.parse({
          op: 'eq',
          field: 'order.dyeMode',
          value: 'TOTAL',
        }),
      ).toMatchObject({ op: 'eq', value: 'TOTAL' });

      expect(
        conditionAstSchema.parse({
          op: 'neq',
          field: 'order.styleId',
          value: 'style-123',
        }),
      ).toMatchObject({ op: 'neq', value: 'style-123' });
    });

    it('rejects unknown field in condition', () => {
      const ast = {
        op: 'eq',
        field: 'order.unknownField',
        value: true,
      };
      expect(() => conditionAstSchema.parse(ast)).toThrow();
    });

    it('rejects unknown operator', () => {
      const ast = {
        op: 'gt',
        field: 'order.dyeRequired',
        value: 10,
      };
      expect(() => conditionAstSchema.parse(ast)).toThrow();
    });

    it('rejects extra unknown properties on leaf node (strict mode)', () => {
      const ast = {
        op: 'eq',
        field: 'order.dyeRequired',
        value: true,
        extraProperty: 'malicious-data',
      };
      expect(() => conditionAstSchema.parse(ast)).toThrow();
    });
  });

  describe('logical operators (and, or, not)', () => {
    it('accepts valid not operator', () => {
      const ast = {
        op: 'not',
        arg: {
          op: 'eq',
          field: 'order.skipCleanWash',
          value: true,
        },
      };
      const parsed = conditionAstSchema.parse(ast);
      expect(parsed).toEqual(ast);
    });

    it('rejects not operator missing arg or with extra properties', () => {
      expect(() =>
        conditionAstSchema.parse({
          op: 'not',
        }),
      ).toThrow();

      expect(() =>
        conditionAstSchema.parse({
          op: 'not',
          arg: { op: 'eq', field: 'order.dyeRequired', value: true },
          extra: true,
        }),
      ).toThrow();
    });

    it('accepts valid and operator with multiple arguments', () => {
      const ast = {
        op: 'and',
        args: [
          { op: 'eq', field: 'order.dyeRequired', value: true },
          { op: 'neq', field: 'order.washTypeId', value: null },
        ],
      };
      const parsed = conditionAstSchema.parse(ast);
      expect(parsed).toEqual(ast);
    });

    it('rejects and operator with empty args array', () => {
      expect(() =>
        conditionAstSchema.parse({
          op: 'and',
          args: [],
        }),
      ).toThrow();
    });

    it('accepts valid or operator with multiple arguments', () => {
      const ast = {
        op: 'or',
        args: [
          { op: 'eq', field: 'order.embroideryRequired', value: true },
          { op: 'eq', field: 'order.isCustom', value: true },
        ],
      };
      const parsed = conditionAstSchema.parse(ast);
      expect(parsed).toEqual(ast);
    });

    it('rejects or operator with empty args array', () => {
      expect(() =>
        conditionAstSchema.parse({
          op: 'or',
          args: [],
        }),
      ).toThrow();
    });

    it('accepts nested composite expressions', () => {
      const complexAst = {
        op: 'and',
        args: [
          {
            op: 'not',
            arg: {
              op: 'eq',
              field: 'order.skipCleanWash',
              value: true,
            },
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
      const parsed = conditionAstSchema.parse(complexAst);
      expect(parsed).toEqual(complexAst);
    });

    it('rejects nested expression containing an invalid child node', () => {
      const badAst = {
        op: 'and',
        args: [
          { op: 'eq', field: 'order.dyeRequired', value: true },
          { op: 'invalid_op', field: 'order.washTypeId', value: null },
        ],
      };
      expect(() => conditionAstSchema.parse(badAst)).toThrow();
    });
  });

  describe('nullableConditionAstSchema', () => {
    it('accepts null and undefined for unconditional steps', () => {
      expect(nullableConditionAstSchema.parse(null)).toBeNull();
      expect(nullableConditionAstSchema.parse(undefined)).toBeUndefined();
    });

    it('accepts valid AST for conditional steps', () => {
      const ast = { op: 'eq', field: 'order.isCustom', value: true };
      expect(nullableConditionAstSchema.parse(ast)).toEqual(ast);
    });
  });

  describe('orderConditionFieldSchema', () => {
    it('validates canonical order.* fields', () => {
      for (const field of ORDER_CONDITION_FIELDS) {
        expect(orderConditionFieldSchema.parse(field)).toBe(field);
      }
    });
  });
});
