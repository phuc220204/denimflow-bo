import { z } from 'zod';
import { dyeModeSchema, dyeSourceSchema, orderStatusSchema } from './enums.js';

export const orderSizeLineSchema = z
  .object({
    size: z.string().trim().min(1, 'Size is required').max(20),
    plannedQty: z.number().int().positive('Planned quantity must be greater than 0'),
  })
  .strict();
export type OrderSizeLineDto = z.infer<typeof orderSizeLineSchema>;

export const createProductionOrderSchema = z
  .object({
    styleId: z.string().uuid('Valid Style ID is required'),
    dueDate: z.string().trim().min(1, 'Due date is required'),
    customerRef: z.string().trim().max(100).nullable().optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
    washTypeId: z.string().uuid().nullable().optional(),
    dyeRequired: z.boolean().optional().default(false),
    dyeMode: dyeModeSchema.nullable().optional(),
    dyeSource: dyeSourceSchema.nullable().optional(),
    embroideryRequired: z.boolean().optional().default(false),
    fabricInspectRequired: z.boolean().optional().default(false),
    ppSampleRequired: z.boolean().optional().default(false),
    skipCleanWash: z.boolean().optional().default(false),
    isCustom: z.boolean().optional().default(false),
    sizeLines: z.array(orderSizeLineSchema).min(1, 'Order must contain at least one size line'),
  })
  .strict()
  .superRefine((data, ctx) => {
    // If dyeRequired is true, dyeMode and dyeSource are required
    if (data.dyeRequired) {
      if (!data.dyeMode) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Dye mode is required when dye is required',
          path: ['dyeMode'],
        });
      }
      if (!data.dyeSource) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Dye source is required when dye is required',
          path: ['dyeSource'],
        });
      }
    }

    // BR-17: If isCustom is true, ppSampleRequired must be true
    if (data.isCustom && data.ppSampleRequired !== true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Pre-production sample (ppSampleRequired) is required when order is custom (BR-17)',
        path: ['ppSampleRequired'],
      });
    }

    // Check unique sizes in sizeLines
    const seenSizes = new Set<string>();
    for (let i = 0; i < data.sizeLines.length; i++) {
      const line = data.sizeLines[i];
      if (!line) continue;
      const normalized = line.size.toUpperCase();
      if (seenSizes.has(normalized)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate size '${line.size}' in order`,
          path: ['sizeLines', i, 'size'],
        });
      }
      seenSizes.add(normalized);
    }
  });
export type CreateProductionOrderDto = z.infer<typeof createProductionOrderSchema>;

export const updateProductionOrderSchema = z
  .object({
    styleId: z.string().uuid().optional(),
    dueDate: z.string().trim().min(1).optional(),
    customerRef: z.string().trim().max(100).nullable().optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
    washTypeId: z.string().uuid().nullable().optional(),
    dyeRequired: z.boolean().optional(),
    dyeMode: dyeModeSchema.nullable().optional(),
    dyeSource: dyeSourceSchema.nullable().optional(),
    embroideryRequired: z.boolean().optional(),
    fabricInspectRequired: z.boolean().optional(),
    ppSampleRequired: z.boolean().optional(),
    skipCleanWash: z.boolean().optional(),
    isCustom: z.boolean().optional(),
    sizeLines: z.array(orderSizeLineSchema).min(1).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.dyeRequired === true) {
      if (!data.dyeMode) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Dye mode is required when dye is required',
          path: ['dyeMode'],
        });
      }
      if (!data.dyeSource) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Dye source is required when dye is required',
          path: ['dyeSource'],
        });
      }
    }

    if (
      data.isCustom === true &&
      data.ppSampleRequired !== true &&
      data.ppSampleRequired !== undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Pre-production sample (ppSampleRequired) is required when order is custom (BR-17)',
        path: ['ppSampleRequired'],
      });
    }

    if (data.sizeLines) {
      const seenSizes = new Set<string>();
      for (let i = 0; i < data.sizeLines.length; i++) {
        const line = data.sizeLines[i];
        if (!line) continue;
        const normalized = line.size.toUpperCase();
        if (seenSizes.has(normalized)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Duplicate size '${line.size}' in order`,
            path: ['sizeLines', i, 'size'],
          });
        }
        seenSizes.add(normalized);
      }
    }
  });
export type UpdateProductionOrderDto = z.infer<typeof updateProductionOrderSchema>;

export const productionOrderQuerySchema = z
  .object({
    status: orderStatusSchema.optional(),
    styleId: z.string().uuid().optional(),
  })
  .strict();
export type ProductionOrderQueryDto = z.infer<typeof productionOrderQuerySchema>;
