import { z } from 'zod';
import { orderStatusSchema, stationTypeSchema } from './enums.js';

export const dashboardWipSummarySchema = z.object({
  ordersByStatus: z.record(orderStatusSchema, z.number()),
  wipByStation: z.array(
    z.object({
      stationType: stationTypeSchema.nullable(),
      stepCode: z.string(),
      stepName: z.string(),
      activeStepCount: z.number(),
      totalQtyIn: z.number(),
      totalQtyGood: z.number(),
      totalQtyDefect: z.number(),
      bundleCount: z.number(),
    }),
  ),
  totals: z.object({
    totalOrders: z.number(),
    activeOrders: z.number(),
    completedOrders: z.number(),
    waitingQcCount: z.number(),
    totalQtyGood: z.number(),
    totalQtyDefect: z.number(),
    totalReworkCount: z.number(),
  }),
  waitingQcOrders: z.array(
    z.object({
      orderId: z.string().uuid(),
      orderNumber: z.string(),
      styleCode: z.string(),
      stepInstanceId: z.string().uuid(),
      stepCode: z.string(),
      stepName: z.string(),
      stationType: stationTypeSchema.nullable(),
      startedAt: z.string().nullable(),
    }),
  ),
});

export type DashboardWipSummaryDto = z.infer<typeof dashboardWipSummarySchema>;
