import {
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type AppConfig } from '../../config/env.schema.js';
import { Role } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { AuthService } from './auth.service.js';

// Fake Supabase Auth: the service must rely on it for every login and token check.
const supabaseAuth = {
  signInWithPassword: vi.fn(),
  getUser: vi.fn(),
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: supabaseAuth }),
}));

describe('AuthService', () => {
  const mockProfile = {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'admin@denimflow.test',
    fullName: 'Quản Trị Viên',
    role: Role.ADMIN,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const createMockPrisma = (profile: typeof mockProfile | null = mockProfile) => ({
    profile: {
      findUnique: vi.fn().mockResolvedValue(profile),
    },
  });

  const baseConfig = {
    PORT: 3000,
    DATABASE_URL: 'http://localhost:5432/mock',
    DIRECT_URL: 'http://localhost:5432/mock',
    CORS_ORIGINS: ['http://localhost:5173'],
  };

  const supabaseConfig: AppConfig = {
    ...baseConfig,
    NODE_ENV: 'development',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'mock-key',
  };

  const noSupabaseConfig: AppConfig = { ...baseConfig, NODE_ENV: 'development' };

  const createService = (config: AppConfig, profile: typeof mockProfile | null = mockProfile) =>
    new AuthService(createMockPrisma(profile) as unknown as PrismaService, config);

  beforeEach(() => {
    supabaseAuth.signInWithPassword.mockReset();
    supabaseAuth.getUser.mockReset();
  });

  describe('login', () => {
    it('returns the Supabase session token and the profile from the database', async () => {
      supabaseAuth.signInWithPassword.mockResolvedValueOnce({
        data: { user: { id: mockProfile.id }, session: { access_token: 'supabase-jwt' } },
        error: null,
      });

      const res = await createService(supabaseConfig).login({
        email: mockProfile.email,
        password: 'correct-password',
      });

      expect(res.accessToken).toBe('supabase-jwt');
      expect(res.user.role).toBe(Role.ADMIN);
    });

    it('rejects a wrong password with 401', async () => {
      supabaseAuth.signInWithPassword.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      });

      await expect(
        createService(supabaseConfig).login({ email: mockProfile.email, password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects an inactive profile with 403', async () => {
      supabaseAuth.signInWithPassword.mockResolvedValueOnce({
        data: { user: { id: mockProfile.id }, session: { access_token: 'supabase-jwt' } },
        error: null,
      });

      await expect(
        createService(supabaseConfig, { ...mockProfile, isActive: false }).login({
          email: mockProfile.email,
          password: 'correct-password',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('refuses to log in without Supabase instead of falling back to a password-less login', async () => {
      await expect(
        createService(noSupabaseConfig).login({ email: mockProfile.email, password: 'anything' }),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('fails at startup in production when Supabase is not configured', () => {
      expect(() => createService({ ...baseConfig, NODE_ENV: 'production' })).toThrow();
    });
  });

  describe('getMe', () => {
    it('returns the profile for a token Supabase accepts', async () => {
      supabaseAuth.getUser.mockResolvedValueOnce({
        data: { user: { id: mockProfile.id } },
        error: null,
      });

      const user = await createService(supabaseConfig).getMe('Bearer supabase-jwt');

      expect(supabaseAuth.getUser).toHaveBeenCalledWith('supabase-jwt');
      expect(user.id).toBe(mockProfile.id);
    });

    it('rejects a forged local-token with 401 (no local bypass)', async () => {
      supabaseAuth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'invalid JWT' },
      });

      await expect(
        createService(supabaseConfig).getMe(`Bearer local-token-${mockProfile.id}`),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects every token when Supabase is not configured', async () => {
      await expect(
        createService(noSupabaseConfig).getMe(`Bearer local-token-${mockProfile.id}`),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('rejects an inactive profile with 403', async () => {
      supabaseAuth.getUser.mockResolvedValueOnce({
        data: { user: { id: mockProfile.id } },
        error: null,
      });

      await expect(
        createService(supabaseConfig, { ...mockProfile, isActive: false }).getMe(
          'Bearer supabase-jwt',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects a missing or malformed header with 401', async () => {
      const service = createService(supabaseConfig);

      await expect(service.getMe(undefined)).rejects.toThrow(UnauthorizedException);
      await expect(service.getMe('InvalidToken')).rejects.toThrow(UnauthorizedException);
    });
  });
});
