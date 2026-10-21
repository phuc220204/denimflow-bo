import { z } from 'zod';
import { qcProfileTypeSchema, qcResultSchema } from './enums.js';

// T5.1 QC inspection (FR-16). Measurements are optional: a criterion that was not measured is not
// judged against the QC Profile (BR-19, R-24).
export const qcDefectInputSchema = z
  .object({
    defectType: z.string().trim().min(1, 'Loại lỗi không được để trống').max(100),
    qty: z.number().int().min(1, 'Số lượng lỗi phải lớn hơn 0'),
    bundleId: z.string().uuid().optional(),
  })
  .strict();

const qcMeasurementsShape = {
  sampleSize: z.number().int().min(1, 'Cỡ mẫu phải lớn hơn 0'),
  measuredShrinkagePercent: z.number().min(0).max(100).nullable().optional(),
  measuredColorFadingLevel: z.number().int().min(0).max(5).nullable().optional(),
  defects: z.array(qcDefectInputSchema).max(50).default([]),
};

const defectsWithinSample = (input: { sampleSize: number; defects: Array<{ qty: number }> }) =>
  input.defects.reduce((sum, defect) => sum + defect.qty, 0) <= input.sampleSize;

const defectsWithinSampleMessage = {
  message: 'Tổng số lỗi không được lớn hơn cỡ mẫu',
  path: ['defects'],
};

export const qcEvaluationInputSchema = z
  .object(qcMeasurementsShape)
  .strict()
  .refine(defectsWithinSample, defectsWithinSampleMessage);
export type QcEvaluationInputDto = z.infer<typeof qcEvaluationInputSchema>;

export const recordQcInspectionSchema = z
  .object({
    ...qcMeasurementsShape,
    result: qcResultSchema,
    notes: z.string().trim().max(1000).optional(),
  })
  .strict()
  .refine(defectsWithinSample, defectsWithinSampleMessage);
export type RecordQcInspectionDto = z.infer<typeof recordQcInspectionSchema>;

export const qcEvaluationSchema = z.object({
  qcProfileId: z.string().uuid().nullable(),
  profileType: qcProfileTypeSchema,
  proposedResult: qcResultSchema,
  criteria: z.array(
    z.object({
      criterion: z.enum(['SHRINKAGE', 'COLOR_FADING']),
      measured: z.number(),
      limit: z.number(),
      passed: z.boolean(),
      reason: z.string(),
    }),
  ),
  totalDefectQty: z.number().int(),
  defectRatePercent: z.number(),
});
export type QcEvaluationDto = z.infer<typeof qcEvaluationSchema>;

export const qcInspectionSchema = z.object({
  id: z.string().uuid(),
  stepInstanceId: z.string().uuid(),
  inspectorId: z.string(),
  qcProfileId: z.string().uuid().nullable(),
  sampleSize: z.number().int(),
  measuredShrinkagePercent: z.number().nullable(),
  measuredColorFadingLevel: z.number().int().nullable(),
  proposedResult: qcResultSchema,
  result: qcResultSchema,
  notes: z.string().nullable(),
  createdAt: z.string(),
  defects: z.array(
    z.object({
      id: z.string().uuid(),
      defectType: z.string(),
      qty: z.number().int(),
      bundleId: z.string().uuid().nullable(),
      bundleCode: z.string().nullable(),
    }),
  ),
});
export type QcInspectionDto = z.infer<typeof qcInspectionSchema>;

export const recordQcInspectionResponseSchema = z.object({
  inspection: qcInspectionSchema,
  stepStatus: z.string(),
  newlyReadyStepCodes: z.array(z.string()),
  newlySkippedStepCodes: z.array(z.string()),
});
export type RecordQcInspectionResponseDto = z.infer<typeof recordQcInspectionResponseSchema>;
