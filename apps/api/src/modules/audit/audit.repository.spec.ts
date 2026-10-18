import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { AuditRepository } from './audit.repository.js';

describe('AuditRepository (T5.6, FR-25)', () => {
  let repository: AuditRepository;
  let prisma: {
    auditLog: {
      count: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
    profile: {
      findMany: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    prisma = {
      auditLog: {
        count: vi.fn(),
        findMany: vi.fn(),
      },
      profile: {
        findMany: vi.fn(),
      },
    };
    repository = new AuditRepository(prisma as unknown as PrismaService);
  });

  it('queries audit logs with filters, resolves actor details, and converts BigInt id to string', async () => {
    prisma.auditLog.count.mockResolvedValue(1);
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: BigInt(12345),
        entityType: 'production_order',
        entityId: 'ord-1111-1111-1111-111111111111',
        action: 'ORDER_CONFIRMED',
        oldValue: { status: 'DRAFT' },
        newValue: { status: 'CONFIRMED' },
        actorId: 'usr-2222-2222-2222-222222222222',
        createdAt: new Date('2026-10-18T14:30:00Z'),
      },
    ]);

    prisma.profile.findMany.mockResolvedValue([
      {
        id: 'usr-2222-2222-2222-222222222222',
        fullName: 'Nguyễn Văn Kế Hoạch',
        email: 'planner@denimflow.internal',
      },
    ]);

    const result = await repository.findAuditLogs({
      entityType: 'production_order',
      entityId: 'ord-1111-1111-1111-111111111111',
      page: 1,
      limit: 10,
    });

    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
    expect(result.totalPages).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual({
      id: '12345',
      entityType: 'production_order',
      entityId: 'ord-1111-1111-1111-111111111111',
      action: 'ORDER_CONFIRMED',
      oldValue: { status: 'DRAFT' },
      newValue: { status: 'CONFIRMED' },
      actorId: 'usr-2222-2222-2222-222222222222',
      actorName: 'Nguyễn Văn Kế Hoạch',
      actorEmail: 'planner@denimflow.internal',
      createdAt: '2026-10-18T14:30:00.000Z',
    });
  });

  it('handles null actorId (system actions) gracefully', async () => {
    prisma.auditLog.count.mockResolvedValue(1);
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: BigInt(999),
        entityType: 'step_instance',
        entityId: 'step-1111-1111-1111-111111111111',
        action: 'SYSTEM_TRANSITION',
        oldValue: null,
        newValue: { status: 'READY' },
        actorId: null,
        createdAt: new Date('2026-10-18T15:00:00Z'),
      },
    ]);

    const result = await repository.findAuditLogs({
      page: 1,
      limit: 20,
    });

    expect(result.items[0]?.actorName).toBeNull();
    expect(result.items[0]?.actorEmail).toBeNull();
    expect(prisma.profile.findMany).not.toHaveBeenCalled();
  });
});
