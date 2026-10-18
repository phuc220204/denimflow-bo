import { z } from 'zod';

export const auditLogQuerySchema = z.object({
  entityType: z.string().optional(),
  entityId: z.string().uuid().optional(),
  actorId: z.string().uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type AuditLogQueryDto = z.infer<typeof auditLogQuerySchema>;

export const auditLogItemSchema = z.object({
  id: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  action: z.string(),
  oldValue: z.unknown().nullable(),
  newValue: z.unknown().nullable(),
  actorId: z.string().nullable(),
  actorName: z.string().nullable(),
  actorEmail: z.string().nullable(),
  createdAt: z.string(),
});

export type AuditLogItemDto = z.infer<typeof auditLogItemSchema>;

export const auditLogListResponseSchema = z.object({
  items: z.array(auditLogItemSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
});

export type AuditLogListResponseDto = z.infer<typeof auditLogListResponseSchema>;
