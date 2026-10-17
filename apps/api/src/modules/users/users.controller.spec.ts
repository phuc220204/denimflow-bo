import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../auth/auth.service.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

describe('UsersController', () => {
  const mockAuthService = {
    getMe: vi.fn(),
  };

  const mockUsersService = {
    getUsers: vi.fn().mockResolvedValue([]),
    createUser: vi.fn().mockResolvedValue({ id: '1' }),
    updateStatus: vi.fn().mockResolvedValue({ id: '1', isActive: false }),
  };

  it('rejects non-admin from listing users with 403 (ForbiddenException)', async () => {
    mockAuthService.getMe.mockResolvedValueOnce({
      id: '2',
      email: 'pe@denimflow.internal',
      role: 'PROCESS_ENGINEER',
      isActive: true,
    });

    const controller = new UsersController(
      mockUsersService as unknown as UsersService,
      mockAuthService as unknown as AuthService,
    );

    await expect(controller.getUsers('Bearer token')).rejects.toThrow(ForbiddenException);
  });

  it('allows admin to list users', async () => {
    mockAuthService.getMe.mockResolvedValueOnce({
      id: '1',
      email: 'admin@denimflow.internal',
      role: 'ADMIN',
      isActive: true,
    });

    const controller = new UsersController(
      mockUsersService as unknown as UsersService,
      mockAuthService as unknown as AuthService,
    );

    const result = await controller.getUsers('Bearer token');
    expect(result).toEqual([]);
  });
});
