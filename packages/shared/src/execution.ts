import { z } from 'zod';
import { roleSchema, stationTypeSchema, stepStatusSchema, stepTypeSchema } from './enums.js';

export const worklistQuerySchema = z.object({
  stationType: stationTypeSchema.optional(),
  status: stepStatusSchema.optional(),
});
export type WorklistQueryDto = z.infer<typeof worklistQuerySchema>;

export const worklistItemSchema = z.object({
  id: z.string().uuid(),
  instanceId: z.string().uuid(),
  stepCode: z.string(),
  stepName: z.string(),
  stepType: stepTypeSchema,
  stationType: stationTypeSchema.nullable().optional(),
  responsibleRole: roleSchema,
  status: stepStatusSchema,
  orderId: z.string().uuid(),
  orderNumber: z.string(),
  styleCode: z.string(),
  styleName: z.string(),
  totalPlannedQty: z.number(),
  qtyIn: z.number().nullable().optional(),
  qtyGood: z.number().nullable().optional(),
  qtyDefect: z.number().nullable().optional(),
  startedAt: z.string().nullable().optional(),
  completedAt: z.string().nullable().optional(),
  performedBy: z.string().nullable().optional(),
  reworkCount: z.number(),
  requiresEvidence: z.boolean(),
  requiresQc: z.boolean(),
  isMandatory: z.boolean(),
  seq: z.number(),
});
export type WorklistItemDto = z.infer<typeof worklistItemSchema>;

export const startStepResponseSchema = z.object({
  id: z.string().uuid(),
  status: stepStatusSchema,
  startedAt: z.string(),
  performedBy: z.string(),
});
export type StartStepResponseDto = z.infer<typeof startStepResponseSchema>;

export const completeStepResponseSchema = z.object({
  id: z.string().uuid(),
  status: stepStatusSchema,
  completedAt: z.string().optional(),
  newlyReadyStepCodes: z.array(z.string()),
  newlySkippedStepCodes: z.array(z.string()),
});
export type CompleteStepResponseDto = z.infer<typeof completeStepResponseSchema>;

// T4.3 quantity entry (FR-13). Cutting entries name a size, later steps a bundle; the service
// checks which one the step needs. Outsourced stations add sent/received (BR-09).
export const recordQuantityEntrySchema = z
  .object({
    size: z.string().trim().min(1).optional(),
    bundleId: z.string().uuid().optional(),
    qtyGood: z.number().int().min(0),
    qtyDefect: z.number().int().min(0).default(0),
    qtySent: z.number().int().min(0).optional(),
    qtyReceived: z.number().int().min(0).optional(),
    mismatchReason: z.string().trim().max(500).optional(),
    note: z.string().trim().max(500).optional(),
  })
  .strict()
  .refine((entry) => (entry.size === undefined) !== (entry.bundleId === undefined), {
    message: 'Chọn đúng một: size (bước cắt) hoặc bó (các bước sau)',
    path: ['bundleId'],
  })
  .refine((entry) => entry.qtyGood + entry.qtyDefect > 0 || (entry.qtySent ?? 0) > 0, {
    message: 'Lần nhập phải có ít nhất 1 sản phẩm',
    path: ['qtyGood'],
  });
export type RecordQuantityEntryDto = z.infer<typeof recordQuantityEntrySchema>;

// A reversal cancels one earlier entry with negated values (R-22).
export const reverseQuantityEntrySchema = z
  .object({ reason: z.string().trim().min(1, 'Phải ghi lý do huỷ dòng nhập').max(500) })
  .strict();
export type ReverseQuantityEntryDto = z.infer<typeof reverseQuantityEntrySchema>;

export const stepQuantityEntrySchema = z.object({
  id: z.string().uuid(),
  stepInstanceId: z.string().uuid(),
  bundleId: z.string().uuid().nullable(),
  bundleCode: z.string().nullable(),
  size: z.string().nullable(),
  qtyGood: z.number().int(),
  qtyDefect: z.number().int(),
  qtySent: z.number().int().nullable(),
  qtyReceived: z.number().int().nullable(),
  mismatchReason: z.string().nullable(),
  note: z.string().nullable(),
  reversesEntryId: z.string().uuid().nullable(),
  isReversed: z.boolean(),
  enteredBy: z.string(),
  enteredAt: z.string(),
});
export type StepQuantityEntryDto = z.infer<typeof stepQuantityEntrySchema>;

// Everything the quantity form of one step needs.
export const stepQuantityPanelSchema = z.object({
  stepId: z.string().uuid(),
  stepCode: z.string(),
  status: stepStatusSchema,
  mode: z.enum(['CUTTING', 'BUNDLE']),
  isOutsourced: z.boolean(),
  qtyIn: z.number().int(),
  qtyGood: z.number().int(),
  qtyDefect: z.number().int(),
  // Good pieces the previous step handed over (BUNDLE mode); completion needs qtyIn to match (BR-08).
  previousGood: z.number().int().nullable(),
  sizes: z.array(
    z.object({
      size: z.string(),
      plannedQty: z.number().int(),
      maxQty: z.number().int(),
      cutQty: z.number().int(),
    }),
  ),
  bundles: z.array(
    z.object({
      id: z.string().uuid(),
      bundleCode: z.string(),
      size: z.string(),
      availableQty: z.number().int(),
      takenQty: z.number().int(),
    }),
  ),
  entries: z.array(stepQuantityEntrySchema),
});
export type StepQuantityPanelDto = z.infer<typeof stepQuantityPanelSchema>;
