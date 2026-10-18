import { z } from 'zod';
import { qcResultSchema } from './enums.js';

export const defectItemInputSchema = z.object({
  defectType: z.string().min(1, 'Loại lỗi không được để trống'),
  qty: z.number().int().min(1, 'Số lượng lỗi phải lớn hơn 0'),
  bundleId: z.string().uuid().optional(),
});
export type DefectItemInputDto = z.infer<typeof defectItemInputSchema>;

export const defectItemSchema = z.object({
  id: z.string().uuid(),
  inspectionId: z.string().uuid(),
  bundleId: z.string().uuid().nullable().optional(),
  defectType: z.string(),
  qty: z.number().int(),
  createdAt: z.string(),
});
export type DefectItemDto = z.infer<typeof defectItemSchema>;

export const evaluateQcInspectionInputSchema = z.object({
  sampleSize: z.number().int().min(1, 'Cỡ mẫu kiểm tra phải lớn hơn 0'),
  measuredShrinkagePercent: z.number().min(0).max(100).nullable().optional(),
  measuredColorFadingLevel: z.number().int().min(0).max(5).nullable().optional(),
  defects: z.array(defectItemInputSchema).optional().default([]),
  maxAllowedDefectRatePercent: z.number().min(0).max(100).optional(),
});
export type EvaluateQcInspectionInputDto = z.input<typeof evaluateQcInspectionInputSchema>;

export const qcEvaluationOutputSchema = z.object({
  passed: z.boolean(),
  proposedResult: qcResultSchema,
  shrinkagePassed: z.boolean(),
  colorFadingPassed: z.boolean(),
  defectRatePassed: z.boolean(),
  totalDefectQty: z.number(),
  defectRatePercent: z.number(),
  reasons: z.array(z.string()),
});
export type QcEvaluationOutputDto = z.infer<typeof qcEvaluationOutputSchema>;

export const recordQcInspectionSchema = z.object({
  stepInstanceId: z.string().uuid(),
  sampleSize: z.number().int().min(1, 'Cỡ mẫu kiểm tra phải lớn hơn 0'),
  measuredShrinkagePercent: z.number().min(0).max(100).nullable().optional(),
  measuredColorFadingLevel: z.number().int().min(0).max(5).nullable().optional(),
  result: qcResultSchema,
  reworkTargetStepId: z.string().uuid().optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
  defects: z.array(defectItemInputSchema).optional().default([]),
});
export type RecordQcInspectionDto = z.input<typeof recordQcInspectionSchema>;

export const qcInspectionResponseSchema = z.object({
  id: z.string().uuid(),
  stepInstanceId: z.string().uuid(),
  inspectorId: z.string().uuid(),
  qcProfileId: z.string().uuid().nullable().optional(),
  sampleSize: z.number().int(),
  measuredShrinkagePercent: z.number().nullable().optional(),
  measuredColorFadingLevel: z.number().nullable().optional(),
  result: qcResultSchema,
  reworkTargetStepId: z.string().uuid().nullable().optional(),
  reason: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  createdAt: z.string(),
  defects: z.array(defectItemSchema),
});
export type QcInspectionResponseDto = z.infer<typeof qcInspectionResponseSchema>;

export const reworkTargetSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  seq: z.number().int(),
  status: z.string(),
  reworkCount: z.number().int(),
  maxRework: z.number().int(),
});
export type ReworkTargetDto = z.infer<typeof reworkTargetSchema>;

export const orderDefectItemSchema = z.object({
  id: z.string().uuid(),
  inspectionId: z.string().uuid(),
  stepCode: z.string(),
  stepName: z.string(),
  bundleId: z.string().uuid().nullable().optional(),
  bundleCode: z.string().nullable().optional(),
  size: z.string().nullable().optional(),
  defectType: z.string(),
  qty: z.number().int(),
  inspectorName: z.string().nullable().optional(),
  createdAt: z.string(),
});
export type OrderDefectItemDto = z.infer<typeof orderDefectItemSchema>;
