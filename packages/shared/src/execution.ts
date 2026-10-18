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
