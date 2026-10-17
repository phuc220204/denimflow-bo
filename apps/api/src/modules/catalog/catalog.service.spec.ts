import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { StationType, StretchType } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { CatalogService } from './catalog.service.js';

describe('CatalogService', () => {
  const mockStation = {
    id: '11111111-1111-1111-1111-111111111111',
    code: 'CUT-01',
    name: 'Xưởng Cắt',
    stationType: StationType.CUTTING,
    isOutsourced: false,
  };

  const mockStyle = {
    id: '22222222-2222-2222-2222-222222222222',
    styleCode: 'JN-SLIM-01',
    name: 'Jeans Slim',
    fitType: 'Slim',
    hasEmbroidery: false,
    isActive: true,
  };

  const createMockPrisma = (overrides = {}) => {
    const tx = {
      station: {
        create: vi.fn().mockResolvedValue(mockStation),
        update: vi.fn().mockResolvedValue(mockStation),
        delete: vi.fn().mockResolvedValue(mockStation),
      },
      style: {
        create: vi.fn().mockResolvedValue(mockStyle),
        update: vi.fn().mockResolvedValue(mockStyle),
        delete: vi.fn().mockResolvedValue(mockStyle),
      },
      fabricType: {
        create: vi.fn().mockResolvedValue({ id: '33333333-3333-3333-3333-333333333333' }),
        update: vi.fn().mockResolvedValue({ id: '33333333-3333-3333-3333-333333333333' }),
        delete: vi.fn().mockResolvedValue({ id: '33333333-3333-3333-3333-333333333333' }),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: 1n }),
      },
    };

    return {
      station: {
        findMany: vi.fn().mockResolvedValue([mockStation]),
        findUnique: vi.fn().mockResolvedValue(null),
      },
      style: {
        findMany: vi.fn().mockResolvedValue([mockStyle]),
        findUnique: vi.fn().mockResolvedValue(null),
      },
      fabricType: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue(null),
      },
      colorOption: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue(null),
      },
      washType: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue(null),
      },
      profile: {
        count: vi.fn().mockResolvedValue(0),
      },
      $transaction: vi.fn(async (cb: (txArg: typeof tx) => Promise<unknown>) => cb(tx)),
      ...overrides,
    };
  };

  it('rejects duplicate station code on create', async () => {
    const prisma = createMockPrisma();
    prisma.station.findUnique = vi.fn().mockResolvedValue(mockStation);
    const service = new CatalogService(prisma as unknown as PrismaService);

    await expect(
      service.createStation({
        code: 'CUT-01',
        name: 'Trạm Cắt Trùng',
        stationType: StationType.CUTTING,
        isOutsourced: false,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('creates station and writes audit log in transaction (BR-16)', async () => {
    const prisma = createMockPrisma();
    const service = new CatalogService(prisma as unknown as PrismaService);

    const result = await service.createStation(
      {
        code: 'CUT-02',
        name: 'Xưởng Cắt 02',
        stationType: StationType.CUTTING,
        isOutsourced: false,
      },
      '44444444-4444-4444-4444-444444444444',
    );

    expect(result).toEqual(mockStation);
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it('rejects deleting a station referenced by active profiles with clear message', async () => {
    const prisma = createMockPrisma();
    prisma.station.findUnique = vi.fn().mockResolvedValue(mockStation);
    prisma.profile.count = vi.fn().mockResolvedValue(3); // 3 linked profiles
    const service = new CatalogService(prisma as unknown as PrismaService);

    await expect(service.deleteStation('11111111-1111-1111-1111-111111111111')).rejects.toThrow(
      'Không thể xóa trạm vì đang có tài khoản nhân sự liên kết với trạm này',
    );
  });

  it('rejects duplicate styleCode on create', async () => {
    const prisma = createMockPrisma();
    prisma.style.findUnique = vi.fn().mockResolvedValue(mockStyle);
    const service = new CatalogService(prisma as unknown as PrismaService);

    await expect(
      service.createStyle({
        styleCode: 'JN-SLIM-01',
        name: 'Jeans Trùng',
        hasEmbroidery: false,
        isActive: true,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when updating non-existent style', async () => {
    const prisma = createMockPrisma();
    prisma.style.findUnique = vi.fn().mockResolvedValue(null);
    const service = new CatalogService(prisma as unknown as PrismaService);

    await expect(service.updateStyle('non-existent-id', { name: 'New Name' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('creates fabric type and writes audit log in transaction (BR-16)', async () => {
    const prisma = createMockPrisma();
    const service = new CatalogService(prisma as unknown as PrismaService);

    const result = await service.createFabricType({
      code: 'DN-14-RIGID',
      name: 'Vải 14oz',
      stretchType: StretchType.RIGID,
    });

    expect(result).toBeDefined();
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });
});
