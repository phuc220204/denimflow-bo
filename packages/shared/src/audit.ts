import { z } from 'zod';

// T5.6 AuditLog viewer (FR-25). Read-only: audit rows are written by the use-cases (BR-16).

export const AUDIT_LOG_DEFAULT_PAGE_SIZE = 20;
export const AUDIT_LOG_MAX_PAGE_SIZE = 100;

// Ids are matched with z.guid(), not z.uuid(): Zod 4's uuid() also checks the RFC version and
// variant bits and rejects the seeded demo ids (00000000-0000-0000-0000-000000000001), while
// Postgres accepts any 8-4-4-4-12 hex id.
export const auditLogQuerySchema = z
  .object({
    entityType: z.string().trim().min(1).max(64).optional(),
    entityId: z.guid().optional(),
    actorId: z.guid().optional(),
    // Both bounds are inclusive.
    from: z.iso.datetime({ offset: true }).optional(),
    to: z.iso.datetime({ offset: true }).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(AUDIT_LOG_MAX_PAGE_SIZE)
      .default(AUDIT_LOG_DEFAULT_PAGE_SIZE),
  })
  .strict()
  .refine((q) => !q.from || !q.to || new Date(q.from) <= new Date(q.to), {
    message: 'Thời điểm bắt đầu phải trước thời điểm kết thúc',
    path: ['to'],
  });
export type AuditLogQueryDto = z.infer<typeof auditLogQuerySchema>;

export const auditLogItemSchema = z.object({
  // audit_logs.id is a BIGINT; JSON has no 64-bit integer, so it travels as a string.
  id: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  action: z.string(),
  oldValue: z.unknown().nullable(),
  newValue: z.unknown().nullable(),
  // Null when the row was written without a user (system action).
  actorId: z.string().nullable(),
  actorName: z.string().nullable(),
  actorEmail: z.string().nullable(),
  createdAt: z.string(),
});
export type AuditLogItemDto = z.infer<typeof auditLogItemSchema>;

export const auditLogListResponseSchema = z.object({
  items: z.array(auditLogItemSchema),
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
  totalPages: z.number().int(),
});
export type AuditLogListResponseDto = z.infer<typeof auditLogListResponseSchema>;

// Values for the filter dropdowns: entity types that exist in the log, and the user accounts.
export const auditLogFilterOptionsSchema = z.object({
  entityTypes: z.array(z.string()),
  actors: z.array(
    z.object({
      id: z.string(),
      fullName: z.string(),
      email: z.string(),
    }),
  ),
});
export type AuditLogFilterOptionsDto = z.infer<typeof auditLogFilterOptionsSchema>;
