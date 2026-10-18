import { describe, expect, it, vi } from 'vitest';
import { AuthController } from './auth.controller.js';
import { type AuthService } from './auth.service.js';

describe('AuthController', () => {
  const mockUser = {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'admin@denimflow.internal',
    fullName: 'Quản Trị Viên',
    role: 'ADMIN',
    isActive: true,
  };

  const mockAuthService = {
    login: vi.fn().mockResolvedValue({
      accessToken: 'token-123',
      user: mockUser,
    }),
    getMe: vi.fn().mockResolvedValue(mockUser),
  } as unknown as AuthService;

  it('delegates login to authService', async () => {
    const controller = new AuthController(mockAuthService);
    const result = await controller.login({
      email: 'admin@denimflow.internal',
      password: 'password123',
    });

    expect(result.accessToken).toBe('token-123');
    expect(mockAuthService.login).toHaveBeenCalledWith({
      email: 'admin@denimflow.internal',
      password: 'password123',
    });
  });

  it('delegates getMe to authService', async () => {
    const controller = new AuthController(mockAuthService);
    const result = await controller.getMe('Bearer token-123');

    expect(result.id).toBe(mockUser.id);
    expect(mockAuthService.getMe).toHaveBeenCalledWith('Bearer token-123');
  });
});
