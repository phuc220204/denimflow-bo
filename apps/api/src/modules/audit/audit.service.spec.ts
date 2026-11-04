import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UsersService } from '../users/users.service.js';
import type { AuditRepository } from './audit.repository.js';
import { AuditService } from './audit.service.js';

const planner = {
  id: '00000000-0000-0000-0000-000000000003',
  email: 'planner@denimflow.internal',
  fullName: 'Điều Độ Kế Hoạch Sản Xuất',
  role: 'PRODUCTION_PLANNER',
  stationId: null,
  stationName: null,
  isActive: true,
  createdAt: new Date('2026-10-01T00:00:00Z'),
};
const admin = {
  ...planner,
  id: '00000000-0000-0000-0000-000000000001',
  email: 'admin@denimflow.internal',
  fullName: 'Quản Trị Viên Hệ Thống',
  role: 'ADMIN',
};

const auditRow = (overrides: Record<string, unknown> = {}) => ({
  id: BigInt(12345),
  entityType: 'ProductionOrder',
  entityId: '11111111-1111-4111-8111-111111111111',
  action: 'CONFIRM_ORDER',
  oldValue: { status: 'DRAFT' },
  newValue: { status: 'CONFIRMED' },
  actorId: planner.id,
  createdAt: new Date('2026-10-18T14:30:00Z'),
  ...overrides,
});

describe('AuditService (FR-25)', () => {
  let repository: { findPage: ReturnType<typeof vi.fn>; findEntityTypes: ReturnType<typeof vi.fn> };
  let users: { getUsers: ReturnType<typeof vi.fn> };
  let service: AuditService;

  beforeEach(() => {
    repository = { findPage: vi.fn(), findEntityTypes: vi.fn() };
    users = { getUsers: vi.fn().mockResolvedValue([planner, admin]) };
    service = new AuditService(
      repository as unknown as AuditRepository,
      users as unknown as UsersService,
    );
  });

  it('FR-25: passes the filters and the page window to the repository', async () => {
    repository.findPage.mockResolvedValue({ total: 0, rows: [] });

    await service.findAuditLogs({
      entityType: 'ProductionOrder',
      actorId: planner.id,
      from: '2026-10-18T00:00:00.000Z',
      to: '2026-10-18T23:59:59.999Z',
      page: 3,
      limit: 20,
    });

    expect(repository.findPage).toHaveBeenCalledWith(
      {
        entityType: 'ProductionOrder',
        entityId: undefined,
        actorId: planner.id,
        from: new Date('2026-10-18T00:00:00.000Z'),
        to: new Date('2026-10-18T23:59:59.999Z'),
      },
      40,
      20,
    );
  });

  it('FR-25: maps rows to the response (BIGINT id as string, ISO time, actor name)', async () => {
    repository.findPage.mockResolvedValue({ total: 41, rows: [auditRow()] });

    const result = await service.findAuditLogs({ page: 1, limit: 20 });

    expect(result).toEqual({
      items: [
        {
          id: '12345',
          entityType: 'ProductionOrder',
          entityId: '11111111-1111-4111-8111-111111111111',
          action: 'CONFIRM_ORDER',
          oldValue: { status: 'DRAFT' },
          newValue: { status: 'CONFIRMED' },
          actorId: planner.id,
          actorName: 'Điều Độ Kế Hoạch Sản Xuất',
          actorEmail: 'planner@denimflow.internal',
          createdAt: '2026-10-18T14:30:00.000Z',
        },
      ],
      total: 41,
      page: 1,
      limit: 20,
      totalPages: 3,
    });
  });

  it('FR-25: leaves the actor empty for system rows and unknown actor ids', async () => {
    repository.findPage.mockResolvedValue({
      total: 2,
      rows: [
        auditRow({ id: BigInt(1), actorId: null, oldValue: null }),
        auditRow({ id: BigInt(2), actorId: '99999999-9999-4999-8999-999999999999' }),
      ],
    });

    const { items } = await service.findAuditLogs({ page: 1, limit: 20 });

    expect(items.map((item) => [item.actorName, item.actorEmail])).toEqual([
      [null, null],
      [null, null],
    ]);
    expect(items[0]?.oldValue).toBeNull();
  });

  it('FR-25: reports one page when nothing matches', async () => {
    repository.findPage.mockResolvedValue({ total: 0, rows: [] });

    const result = await service.findAuditLogs({ page: 1, limit: 20 });

    expect(result.totalPages).toBe(1);
    expect(result.items).toEqual([]);
  });

  it('FR-25: lists the logged entity types and the accounts sorted by name', async () => {
    repository.findEntityTypes.mockResolvedValue(['ProductionOrder', 'StepInstance']);

    const options = await service.getFilterOptions();

    expect(options).toEqual({
      entityTypes: ['ProductionOrder', 'StepInstance'],
      actors: [
        { id: planner.id, fullName: planner.fullName, email: planner.email },
        { id: admin.id, fullName: admin.fullName, email: admin.email },
      ],
    });
  });
});
