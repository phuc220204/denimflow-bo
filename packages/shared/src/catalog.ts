import { z } from 'zod';
import { stationTypeSchema, stretchTypeSchema } from './enums.js';

// Station
export const createStationSchema = z.object({
  code: z.string().trim().min(1, 'Mã trạm không được để trống'),
  name: z.string().trim().min(1, 'Tên trạm không được để trống'),
  stationType: stationTypeSchema,
  isOutsourced: z.boolean().default(false),
});
export const updateStationSchema = createStationSchema.partial();
export type CreateStationDto = z.infer<typeof createStationSchema>;
export type UpdateStationDto = z.infer<typeof updateStationSchema>;

// Style
export const createStyleSchema = z.object({
  styleCode: z.string().trim().min(1, 'Mã kiểu dáng không được để trống'),
  name: z.string().trim().min(1, 'Tên kiểu dáng không được để trống'),
  fitType: z.string().trim().optional().nullable(),
  hasEmbroidery: z.boolean().default(false),
  // BR-07: the cut may exceed the plan by this percentage (R-19)
  cutTolerancePercent: z.number().min(0).max(100).optional(),
  isActive: z.boolean().default(true),
});
export const updateStyleSchema = createStyleSchema.partial();
export type CreateStyleDto = z.infer<typeof createStyleSchema>;
export type UpdateStyleDto = z.infer<typeof updateStyleSchema>;

// FabricType
export const createFabricTypeSchema = z.object({
  code: z.string().trim().min(1, 'Mã loại vải không được để trống'),
  name: z.string().trim().min(1, 'Tên loại vải không được để trống'),
  weightOz: z.number().min(0, 'Định lượng vải phải lớn hơn hoặc bằng 0').optional().nullable(),
  composition: z.string().trim().optional().nullable(),
  stretchType: stretchTypeSchema,
});
export const updateFabricTypeSchema = createFabricTypeSchema.partial();
export type CreateFabricTypeDto = z.infer<typeof createFabricTypeSchema>;
export type UpdateFabricTypeDto = z.infer<typeof updateFabricTypeSchema>;

// ColorOption
export const createColorOptionSchema = z.object({
  code: z.string().trim().min(1, 'Mã màu không được để trống'),
  name: z.string().trim().min(1, 'Tên màu không được để trống'),
  colorFamily: z.string().trim().optional().nullable(),
});
export const updateColorOptionSchema = createColorOptionSchema.partial();
export type CreateColorOptionDto = z.infer<typeof createColorOptionSchema>;
export type UpdateColorOptionDto = z.infer<typeof updateColorOptionSchema>;

// WashType
export const createWashTypeSchema = z.object({
  code: z.string().trim().min(1, 'Mã kiểu giặt không được để trống'),
  name: z.string().trim().min(1, 'Tên kiểu giặt không được để trống'),
  description: z.string().trim().optional().nullable(),
});
export const updateWashTypeSchema = createWashTypeSchema.partial();
export type CreateWashTypeDto = z.infer<typeof createWashTypeSchema>;
export type UpdateWashTypeDto = z.infer<typeof updateWashTypeSchema>;

// Fabric-Color Rule (BR-04, FR-02)
export const toggleFabricColorRuleSchema = z.object({
  fabricTypeId: z.string().uuid('Mã định danh loại vải không hợp lệ'),
  colorId: z.string().uuid('Mã định danh màu sắc không hợp lệ'),
  isAllowed: z.boolean(),
});
export type ToggleFabricColorRuleDto = z.infer<typeof toggleFabricColorRuleSchema>;

// QC Profile (BR-19, FR-28)
export const updateQcProfileSchema = z.object({
  maxShrinkagePercent: z
    .number()
    .min(0, 'Độ co tối đa phải lớn hơn hoặc bằng 0')
    .max(100, 'Độ co tối đa không quá 100%'),
  maxColorFadingLevel: z
    .number()
    .int()
    .min(0, 'Mức phai màu từ 0 đến 5')
    .max(5, 'Mức phai màu tối đa là cấp 5'),
  isActive: z.boolean().default(true).optional(),
});
export type UpdateQcProfileDto = z.infer<typeof updateQcProfileSchema>;
