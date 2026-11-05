import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants.js';
import { Role } from '@denimflow/shared';
import { describe, expect, it, vi } from 'vitest';
import { AuthGuard } from '../auth/auth.guard.js';
import type { AuthResponse } from '../auth/auth.service.js';
import { ROLES_KEY } from '../auth/roles.decorator.js';
import { UsersController } from './users.controller.js';
import type { UsersService } from './users.service.js';

const admin: AuthResponse['user'] = {
  id: 'admin-uuid',
  email: 'admin@denimflow.internal',
  fullName: 'Admin',
  role: 'ADMIN',
  isActive: true,
};

describe('UsersController (FR-01)', () => {
  const service = {
    getUsers: vi.fn().mockResolvedValue([]),
    createUser: vi.fn().mockResolvedValue({ id: '1' }),
    updateStatus: vi.fn().mockResolvedValue({ id: '1', isActive: false }),
    updateAssignment: vi.fn().mockResolvedValue({ id: '1' }),
  };
  const controller = new UsersController(service as unknown as UsersService);

  it('FR-01: is guarded and limited to Admin', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, UsersController)).toEqual([AuthGuard]);
    expect(Reflect.getMetadata(ROLES_KEY, UsersController)).toEqual([Role.ADMIN]);
  });

  it('FR-01: lists users through the service', async () => {
    await expect(controller.getUsers()).resolves.toEqual([]);
  });

  it('FR-01: passes the verified Admin id as the actor when deactivating a user', async () => {
    await controller.updateStatus('user-2', { isActive: false }, admin);

    expect(service.updateStatus).toHaveBeenCalledWith('user-2', { isActive: false }, 'admin-uuid');
  });
});
