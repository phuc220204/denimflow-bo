import { z } from 'zod';
import { requestStatusSchema } from './enums.js';

export const allocateFabricSchema = z
  .object({
    orderId: z.string().uuid('Valid Order ID is required'),
    bomLineId: z.string().uuid('Valid BOM Line ID is required'),
    fabricLotId: z.string().uuid('Valid Fabric Lot ID is required'),
    quantity: z.number().positive('Allocation quantity must be greater than 0'),
  })
  .strict();
export type AllocateFabricDto = z.infer<typeof allocateFabricSchema>;

export const fabricLotDtoSchema = z.object({
  id: z.string().uuid(),
  fabricTypeId: z.string().uuid(),
  colorId: z.string().uuid(),
  lotNo: z.string(),
  availableMeters: z.number().nonnegative(),
  shrinkagePercent: z.number().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  fabricType: z
    .object({
      id: z.string().uuid(),
      code: z.string(),
      name: z.string(),
    })
    .optional(),
  colorOption: z
    .object({
      id: z.string().uuid(),
      code: z.string(),
      name: z.string(),
    })
    .optional(),
});
export type FabricLotDto = z.infer<typeof fabricLotDtoSchema>;

export const materialAllocationDtoSchema = z.object({
  id: z.string().uuid(),
  bomLineId: z.string().uuid(),
  fabricLotId: z.string().uuid(),
  allocatedQty: z.number().positive(),
  createdAt: z.string().optional(),
  fabricLot: z
    .object({
      id: z.string().uuid(),
      lotNo: z.string(),
      availableMeters: z.number(),
    })
    .optional(),
});
export type MaterialAllocationDto = z.infer<typeof materialAllocationDtoSchema>;

export const materialRequestDtoSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  bomLineId: z.string().uuid(),
  missingQty: z.number().positive(),
  status: requestStatusSchema,
  requestedBy: z.string().uuid(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  requester: z
    .object({
      id: z.string().uuid(),
      fullName: z.string(),
      email: z.string(),
    })
    .optional(),
  order: z
    .object({
      id: z.string().uuid(),
      orderNumber: z.string(),
    })
    .optional(),
});
export type MaterialRequestDto = z.infer<typeof materialRequestDtoSchema>;

export const cuttingGateResultSchema = z.object({
  passed: boolean(),
  ruleId: z.string().optional(),
  reason: z.string().optional(),
  requiredQty: z.number().optional(),
  allocatedQty: z.number().optional(),
  missingQty: z.number().optional(),
});
function boolean() {
  return z.boolean();
}
export type CuttingGateResultDto = z.infer<typeof cuttingGateResultSchema>;
