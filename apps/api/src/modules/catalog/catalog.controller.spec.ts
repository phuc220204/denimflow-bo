import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { StationType } from '../../generated/prisma/enums.js';
import { AuthService } from '../auth/auth.service.js';
import { CatalogController } from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';

describe('CatalogController', () => {
  const mockCatalogService = {
    getStations: vi.fn().mockResolvedValue([]),
    createStation: vi.fn().mockResolvedValue({ id: '1', code: 'CUT-01' }),
  };

  const mockAuthService = {
    getMe: vi.fn(),
  };

  it('allows reading stations without admin role', async () => {
    const controller = new CatalogController(
      mockCatalogService as unknown as CatalogService,
      mockAuthService as unknown as AuthService,
    );

    const result = await controller.getStations();
    expect(result).toEqual([]);
    expect(mockCatalogService.getStations).toHaveBeenCalledOnce();
  });

  it('forbids non-Admin user from creating a station (RBAC)', async () => {
    mockAuthService.getMe.mockResolvedValue({
      id: 'user-operator',
      role: 'STATION_OPERATOR',
    });

    const controller = new CatalogController(
      mockCatalogService as unknown as CatalogService,
      mockAuthService as unknown as AuthService,
    );

    await expect(
      controller.createStation(
        {
          code: 'CUT-01',
          name: 'Trạm Cắt',
          stationType: StationType.CUTTING,
          isOutsourced: false,
        },
        'Bearer operator-token',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows Admin user to create a station', async () => {
    mockAuthService.getMe.mockResolvedValue({
      id: 'admin-uuid',
      role: 'ADMIN',
    });

    const controller = new CatalogController(
      mockCatalogService as unknown as CatalogService,
      mockAuthService as unknown as AuthService,
    );

    const result = await controller.createStation(
      {
        code: 'CUT-01',
        name: 'Trạm Cắt',
        stationType: StationType.CUTTING,
        isOutsourced: false,
      },
      'Bearer admin-token',
    );

    expect(result).toEqual({ id: '1', code: 'CUT-01' });
    expect(mockCatalogService.createStation).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'CUT-01' }),
      'admin-uuid',
    );
  });
});
