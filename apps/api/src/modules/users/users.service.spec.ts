import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { type AppConfig } from '../../config/env.schema.js';
import { Role } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { UsersService } from './users.service.js';

describe('UsersService', () => {
  const mockProfile = {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'operator@denimflow.internal',
    fullName: 'Tổ Trưởng Cắt',
    role: Role.STATION_OPERATOR,
    stationId: '22222222-2222-2222-2222-222222222222',
    isActive: true,
    createdAt: new Date(),
    station: {
      id: '22222222-2222-2222-2222-222222222222',
      code: 'CUT-01',
      name: 'Xưởng Cắt',
    },
  };

  const createMockPrisma = (overrides = {}) => {
    const tx = {
      profile: {
        create: vi.fn().mockResolvedValue(mockProfile),
        update: vi.fn().mockResolvedValue({ ...mockProfile, isActive: false }),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: 10n }),
      },
    };

    return {
      profile: {
        findMany: vi.fn().mockResolvedValue([mockProfile]),
        findUnique: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(2),
      },
      station: {
        findUnique: vi.fn().mockResolvedValue(mockProfile.station),
      },
      $transaction: vi.fn(async (cb: (txArg: typeof tx) => Promise<unknown>) => cb(tx)),
      ...overrides,
    };
  };

  const mockConfig: AppConfig = {
    PORT: 3000,
    DATABASE_URL: 'http://localhost:5432/mock',
    DIRECT_URL: 'http://localhost:5432/mock',
    CORS_ORIGINS: ['http://localhost:5173'],
    NODE_ENV: 'test',
  };

  it('lists users with formatted station name', async () => {
    const prisma = createMockPrisma();
    const service = new UsersService(prisma as unknown as PrismaService, mockConfig);

    const users = await service.getUsers();
    expect(users).toHaveLength(1);
    expect(users[0]?.stationName).toBe('CUT-01 - Xưởng Cắt');
  });

  it('rejects creating user with duplicate email', async () => {
    const prisma = createMockPrisma();
    prisma.profile.findUnique = vi.fn().mockResolvedValue(mockProfile);
    const service = new UsersService(prisma as unknown as PrismaService, mockConfig);

    await expect(
      service.createUser({
        email: 'operator@denimflow.internal',
        password: 'password123',
        fullName: 'Người Mới',
        role: Role.STATION_OPERATOR,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('creates user and writes audit log in transaction (BR-16)', async () => {
    const prisma = createMockPrisma();
    const service = new UsersService(prisma as unknown as PrismaService, mockConfig);

    const result = await service.createUser(
      {
        email: 'newuser@denimflow.internal',
        password: 'password123',
        fullName: 'Người Mới',
        role: Role.STATION_OPERATOR,
        stationId: '22222222-2222-2222-2222-222222222222',
      },
      '00000000-0000-0000-0000-000000000001',
    );

    expect(result.email).toBe('operator@denimflow.internal');
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it('updates user status and writes audit log (BR-16)', async () => {
    const prisma = createMockPrisma();
    prisma.profile.findUnique = vi.fn().mockResolvedValue(mockProfile);
    const service = new UsersService(prisma as unknown as PrismaService, mockConfig);

    const result = await service.updateStatus(
      mockProfile.id,
      { isActive: false },
      '00000000-0000-0000-0000-000000000001',
    );

    expect(result.isActive).toBe(false);
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it('throws NotFoundException when updating non-existent user', async () => {
    const prisma = createMockPrisma();
    prisma.profile.findUnique = vi.fn().mockResolvedValue(null);
    const service = new UsersService(prisma as unknown as PrismaService, mockConfig);

    await expect(service.updateStatus('non-existent-id', { isActive: false })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('updates role and station assignment with audit log (BR-16)', async () => {
    const prisma = createMockPrisma();
    prisma.profile.findUnique = vi.fn().mockResolvedValue(mockProfile);
    const service = new UsersService(prisma as unknown as PrismaService, mockConfig);

    const result = await service.updateAssignment(
      mockProfile.id,
      {
        role: Role.QC_INSPECTOR,
        stationId: '22222222-2222-2222-2222-222222222222',
      },
      '00000000-0000-0000-0000-000000000001',
    );

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(result).toBeDefined();
  });

  it('rejects demoting the only active Admin', async () => {
    const prisma = createMockPrisma();
    prisma.profile.findUnique = vi.fn().mockResolvedValue({
      ...mockProfile,
      role: Role.ADMIN,
      isActive: true,
    });
    prisma.profile.count = vi.fn().mockResolvedValue(1);
    const service = new UsersService(prisma as unknown as PrismaService, mockConfig);

    await expect(
      service.updateAssignment(mockProfile.id, {
        role: Role.STATION_OPERATOR,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when assigned station does not exist', async () => {
    const prisma = createMockPrisma();
    prisma.profile.findUnique = vi.fn().mockResolvedValue(mockProfile);
    prisma.station.findUnique = vi.fn().mockResolvedValue(null);
    const service = new UsersService(prisma as unknown as PrismaService, mockConfig);

    await expect(
      service.updateAssignment(mockProfile.id, {
        stationId: '22222222-2222-2222-2222-222222222222',
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
