import { z } from 'zod';

// Source of truth: docs/en/BUSINESS_RECONCILIATION.md §3, DATABASE_DESIGN.md §4.2-§4.3,
// and .agents/tasks/S2-workflow-engine-and-designer.md (T2.2).
// Conditions are stored as JSON AST in `step_definitions.condition_expr` and
// `step_transitions.condition_expr`.

export const CANONICAL_ORDER_CONDITION_FIELDS = [
  'order.styleId',
  'order.fabricTypeId',
  'order.colorId',
  'order.washTypeId',
  'order.dyeRequired',
  'order.dyeMode',
  'order.dyeSource',
  'order.embroideryRequired',
  'order.fabricInspectRequired',
  'order.ppSampleRequired',
  'order.skipCleanWash',
  'order.qcProfileId',
  'order.isCustom',
  'order.status',
  'order.dueDate',
  'order.orderNumber',
  'order.customerRef',
  'order.notes',
] as const;

export const SHORT_ORDER_CONDITION_FIELDS = [
  'styleId',
  'fabricTypeId',
  'colorId',
  'washTypeId',
  'dyeRequired',
  'dyeMode',
  'dyeSource',
  'embroideryRequired',
  'fabricInspectRequired',
  'ppSampleRequired',
  'skipCleanWash',
  'qcProfileId',
  'isCustom',
  'status',
  'dueDate',
  'orderNumber',
  'customerRef',
  'notes',
] as const;

export const ORDER_CONDITION_FIELDS = [
  ...CANONICAL_ORDER_CONDITION_FIELDS,
  ...SHORT_ORDER_CONDITION_FIELDS,
] as const;

export const orderConditionFieldSchema = z.enum(ORDER_CONDITION_FIELDS);
export type OrderConditionField = z.infer<typeof orderConditionFieldSchema>;

export const conditionLiteralValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export type ConditionLiteralValue = z.infer<typeof conditionLiteralValueSchema>;

export const ConditionOperator = {
  EQ: 'eq',
  NEQ: 'neq',
  AND: 'and',
  OR: 'or',
  NOT: 'not',
} as const;
export type ConditionOperator = (typeof ConditionOperator)[keyof typeof ConditionOperator];

export type EqConditionAst = {
  op: 'eq';
  field: OrderConditionField;
  value: ConditionLiteralValue;
};

export type NeqConditionAst = {
  op: 'neq';
  field: OrderConditionField;
  value: ConditionLiteralValue;
};

export type AndConditionAst = {
  op: 'and';
  args: ConditionAst[];
};

export type OrConditionAst = {
  op: 'or';
  args: ConditionAst[];
};

export type NotConditionAst = {
  op: 'not';
  arg: ConditionAst;
};

export type ConditionAst =
  EqConditionAst | NeqConditionAst | AndConditionAst | OrConditionAst | NotConditionAst;

export const eqConditionSchema = z
  .object({
    op: z.literal(ConditionOperator.EQ),
    field: orderConditionFieldSchema,
    value: conditionLiteralValueSchema,
  })
  .strict();

export const neqConditionSchema = z
  .object({
    op: z.literal(ConditionOperator.NEQ),
    field: orderConditionFieldSchema,
    value: conditionLiteralValueSchema,
  })
  .strict();

export const conditionAstSchema: z.ZodType<ConditionAst> = z.lazy(() =>
  z.discriminatedUnion('op', [
    eqConditionSchema,
    neqConditionSchema,
    z
      .object({
        op: z.literal(ConditionOperator.AND),
        args: z.array(conditionAstSchema).min(1, 'AND expression must contain at least 1 operand'),
      })
      .strict(),
    z
      .object({
        op: z.literal(ConditionOperator.OR),
        args: z.array(conditionAstSchema).min(1, 'OR expression must contain at least 1 operand'),
      })
      .strict(),
    z
      .object({
        op: z.literal(ConditionOperator.NOT),
        arg: conditionAstSchema,
      })
      .strict(),
  ]),
) as unknown as z.ZodType<ConditionAst>;

export const nullableConditionAstSchema = conditionAstSchema.nullable().optional();

// Context passed into evaluation
export interface OrderConditionData {
  styleId?: string | null;
  fabricTypeId?: string | null;
  colorId?: string | null;
  washTypeId?: string | null;
  dyeRequired?: boolean | null;
  dyeMode?: string | null;
  dyeSource?: string | null;
  embroideryRequired?: boolean | null;
  fabricInspectRequired?: boolean | null;
  ppSampleRequired?: boolean | null;
  skipCleanWash?: boolean | null;
  qcProfileId?: string | null;
  isCustom?: boolean | null;
  status?: string | null;
  dueDate?: string | Date | null;
  orderNumber?: string | null;
  customerRef?: string | null;
  notes?: string | null;
  [key: string]: unknown;
}

export type OrderConditionContext = OrderConditionData | { order: OrderConditionData };
