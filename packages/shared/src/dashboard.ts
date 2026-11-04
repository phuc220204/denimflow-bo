import { z } from 'zod';
import { orderStatusSchema, stationTypeSchema, stepStatusSchema } from './enums.js';

// FR-21 dashboard. Definitions of WIP, totals and "waiting for QC": BUSINESS_RECONCILIATION R-26.

// One row per step code, across all orders and template versions.
export const dashboardStepRowSchema = z.object({
  stepCode: z.string(),
  stepName: z.string(),
  seq: z.number().int(),
  stationType: stationTypeSchema.nullable(),
  tracksQuantities: z.boolean(),
  // Open steps of running orders: how many orders are at this step right now.
  openOrderCount: z.number().int(),
  // Bundles handed over to an open step and their pieces (at cutting: pieces cut so far).
  wipBundleCount: z.number().int(),
  wipQty: z.number().int(),
  // Totals over every order; each piece is counted once at this step.
  qtyIn: z.number().int(),
  qtyGood: z.number().int(),
  qtyDefect: z.number().int(),
  reworkCount: z.number().int(),
});
export type DashboardStepRowDto = z.infer<typeof dashboardStepRowSchema>;

export const dashboardWaitingQcItemSchema = z.object({
  orderId: z.guid(),
  orderNumber: z.string(),
  styleCode: z.string(),
  stepInstanceId: z.guid(),
  stepCode: z.string(),
  stepName: z.string(),
  stationType: stationTypeSchema.nullable(),
  status: stepStatusSchema,
  startedAt: z.string().nullable(),
});
export type DashboardWaitingQcItemDto = z.infer<typeof dashboardWaitingQcItemSchema>;

export const dashboardWipSummarySchema = z.object({
  ordersByStatus: z.record(orderStatusSchema, z.number().int()),
  totals: z.object({
    totalOrders: z.number().int(),
    activeOrders: z.number().int(),
    completedOrders: z.number().int(),
    wipBundleCount: z.number().int(),
    wipQty: z.number().int(),
    totalQtyDefect: z.number().int(),
    totalReworkCount: z.number().int(),
    waitingQcOrderCount: z.number().int(),
  }),
  steps: z.array(dashboardStepRowSchema),
  waitingQc: z.array(dashboardWaitingQcItemSchema),
});
export type DashboardWipSummaryDto = z.infer<typeof dashboardWipSummarySchema>;
