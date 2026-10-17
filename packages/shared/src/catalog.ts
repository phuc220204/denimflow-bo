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
