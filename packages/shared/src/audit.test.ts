import { describe, expect, it } from 'vitest';
import { AUDIT_LOG_MAX_PAGE_SIZE, auditLogQuerySchema } from './audit.js';

describe('auditLogQuerySchema (FR-25)', () => {
  it('FR-25: defaults to the first page of 20 rows', () => {
    expect(auditLogQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
  });

  it('FR-25: coerces page and limit from query strings', () => {
    const query = auditLogQuerySchema.parse({ page: '3', limit: '50' });
    expect(query.page).toBe(3);
    expect(query.limit).toBe(50);
  });

  it('FR-25: caps the page size', () => {
    expect(auditLogQuerySchema.safeParse({ limit: String(AUDIT_LOG_MAX_PAGE_SIZE) }).success).toBe(
      true,
    );
    expect(
      auditLogQuerySchema.safeParse({ limit: String(AUDIT_LOG_MAX_PAGE_SIZE + 1) }).success,
    ).toBe(false);
    expect(auditLogQuerySchema.safeParse({ page: '0' }).success).toBe(false);
  });

  it('FR-25: accepts the seeded demo ids as actor and entity ids', () => {
    const query = auditLogQuerySchema.parse({
      actorId: '00000000-0000-0000-0000-000000000001',
      entityId: '00000000-0000-0000-0000-000000000003',
    });
    expect(query.actorId).toBe('00000000-0000-0000-0000-000000000001');
  });

  it('FR-25: rejects ids that are not UUID-shaped', () => {
    expect(auditLogQuerySchema.safeParse({ entityId: 'ord-1' }).success).toBe(false);
  });

  it('FR-25: requires ISO date-times and from before to', () => {
    expect(auditLogQuerySchema.safeParse({ from: '2026-10-19' }).success).toBe(false);
    expect(
      auditLogQuerySchema.safeParse({
        from: '2026-10-19T00:00:00+07:00',
        to: '2026-10-19T23:59:59.999+07:00',
      }).success,
    ).toBe(true);
    const reversed = auditLogQuerySchema.safeParse({
      from: '2026-10-20T00:00:00.000Z',
      to: '2026-10-19T00:00:00.000Z',
    });
    expect(reversed.success).toBe(false);
    expect(reversed.error?.issues[0]?.path).toEqual(['to']);
  });

  it('FR-25: rejects unknown query parameters', () => {
    expect(auditLogQuerySchema.safeParse({ sort: 'asc' }).success).toBe(false);
  });
});
