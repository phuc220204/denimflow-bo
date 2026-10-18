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

// T4.3 Quantity & Bundle schemas
export const recordQuantityEntrySchema = z.object({
  bundleId: z.string().uuid().optional(),
  size: z.string().optional(),
  qtyGood: z.number().int().min(0),
  qtyDefect: z.number().int().min(0).default(0),
  qtySent: z.number().int().min(0).optional(),
  qtyReceived: z.number().int().min(0).optional(),
  mismatchReason: z.string().optional(),
  note: z.string().optional(),
});
export type RecordQuantityEntryDto = z.infer<typeof recordQuantityEntrySchema>;

export const stepQuantityEntrySchema = z.object({
  id: z.string().uuid(),
  stepInstanceId: z.string().uuid(),
  bundleId: z.string().uuid().nullable().optional(),
  size: z.string().nullable().optional(),
  qtyGood: z.number().int(),
  qtyDefect: z.number().int(),
  qtySent: z.number().int().nullable().optional(),
  qtyReceived: z.number().int().nullable().optional(),
  mismatchReason: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  enteredBy: z.string().uuid(),
  enteredAt: z.string(),
});
export type StepQuantityEntryDto = z.infer<typeof stepQuantityEntrySchema>;

export const bundleSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  bundleCode: z.string(),
  size: z.string(),
  qty: z.number().int(),
  currentStepInstanceId: z.string().uuid().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type BundleDto = z.infer<typeof bundleSchema>;

// T4.4 Evidence schemas (FR-14, BR-15)
export const attachEvidenceSchema = z.object({
  filePath: z.string().min(1, 'Đường dẫn file không được để trống'),
  note: z.string().optional(),
});
export type AttachEvidenceDto = z.infer<typeof attachEvidenceSchema>;

export const evidenceSchema = z.object({
  id: z.string().uuid(),
  stepInstanceId: z.string().uuid(),
  filePath: z.string(),
  note: z.string().nullable().optional(),
  uploadedBy: z.string().uuid(),
  uploadedAt: z.string(),
});
export type EvidenceDto = z.infer<typeof evidenceSchema>;

// T4.5 / T5.1 QC Approval schemas (BR-11)
export const approveQcSchema = z.object({
  notes: z.string().optional(),
});
export type ApproveQcDto = z.infer<typeof approveQcSchema>;
