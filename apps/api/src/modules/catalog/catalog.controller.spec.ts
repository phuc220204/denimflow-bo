import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants.js';
import { Role } from '@denimflow/shared';
import { describe, expect, it, vi } from 'vitest';
import { StationType } from '../../generated/prisma/enums.js';
import { AuthGuard } from '../auth/auth.guard.js';
import type { AuthResponse } from '../auth/auth.service.js';
import { ROLES_KEY } from '../auth/roles.decorator.js';
import { CatalogController } from './catalog.controller.js';
import type { CatalogService } from './catalog.service.js';

const admin: AuthResponse['user'] = {
  id: 'admin-uuid',
  email: 'admin@denimflow.internal',
  fullName: 'Admin',
  role: 'ADMIN',
  isActive: true,
};

const rolesOf = (method: keyof CatalogController): unknown =>
  Reflect.getMetadata(ROLES_KEY, CatalogController.prototype[method]);

describe('CatalogController (FR-02)', () => {
  const service = {
    getStations: vi.fn().mockResolvedValue([]),
    createStation: vi.fn().mockResolvedValue({ id: '1', code: 'CUT-01' }),
  };
  const controller = new CatalogController(service as unknown as CatalogService);

  it('FR-02: every route requires a login', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, CatalogController)).toEqual([AuthGuard]);
  });

  it('FR-02: read routes are open to any active user', () => {
    for (const method of [
      'getStations',
      'getStyles',
      'getFabricTypes',
      'getColorOptions',
      'getWashTypes',
      'getMatrix',
      'getAllowedColors',
      'getQcProfiles',
    ] as const) {
      expect(rolesOf(method)).toBeUndefined();
    }
  });

  it('FR-02: write routes are limited to Admin', () => {
    for (const method of [
      'createStation',
      'updateStation',
      'deleteStation',
      'createStyle',
      'updateStyle',
      'deleteStyle',
      'createFabricType',
      'updateFabricType',
      'deleteFabricType',
      'createColorOption',
      'updateColorOption',
      'deleteColorOption',
      'createWashType',
      'updateWashType',
      'deleteWashType',
      'toggleMatrixRule',
    ] as const) {
      expect(rolesOf(method)).toEqual([Role.ADMIN]);
    }
  });

  it('FR-28: QC Profile thresholds may be edited by Admin or Process Engineer', () => {
    expect(rolesOf('updateQcProfile')).toEqual([Role.ADMIN, Role.PROCESS_ENGINEER]);
  });

  it('FR-02: passes the verified Admin id as the actor when creating a station', async () => {
    const result = await controller.createStation(
      { code: 'CUT-01', name: 'Trạm Cắt', stationType: StationType.CUTTING, isOutsourced: false },
      admin,
    );

    expect(result).toEqual({ id: '1', code: 'CUT-01' });
    expect(service.createStation).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'CUT-01' }),
      'admin-uuid',
    );
  });
});
