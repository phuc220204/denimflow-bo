import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { type AppConfig } from '../../config/env.schema.js';
import { Role } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  const mockProfile = {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'admin@denimflow.internal',
    fullName: 'Quản Trị Viên',
    role: Role.ADMIN,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const createMockPrisma = (overrides = {}) => ({
    profile: {
      findUnique: vi.fn().mockResolvedValue(mockProfile),
      findFirst: vi.fn().mockResolvedValue(mockProfile),
    },
    ...overrides,
  });

  const devConfig: AppConfig = {
    NODE_ENV: 'development',
    PORT: 3000,
    DATABASE_URL: 'http://localhost:5432/mock',
    DIRECT_URL: 'http://localhost:5432/mock',
    CORS_ORIGINS: ['http://localhost:5173'],
  };

  const prodConfig: AppConfig = {
    NODE_ENV: 'production',
    PORT: 3000,
    DATABASE_URL: 'http://localhost:5432/mock',
    DIRECT_URL: 'http://localhost:5432/mock',
    CORS_ORIGINS: ['http://localhost:5173'],
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'mock-key',
  };

  describe('login', () => {
    it('returns local token and user in development when profile is active', async () => {
      const prisma = createMockPrisma();
      const service = new AuthService(prisma as unknown as PrismaService, devConfig);

      const res = await service.login({
        email: 'admin@denimflow.internal',
        password: 'any-password',
      });

      expect(res.accessToken).toBe(`local-token-${mockProfile.id}`);
      expect(res.user.email).toBe(mockProfile.email);
      expect(res.user.isActive).toBe(true);
    });

    it('rejects login with 403 Forbidden when account is inactive', async () => {
      const prisma = createMockPrisma({
        profile: {
          findUnique: vi.fn().mockResolvedValue({ ...mockProfile, isActive: false }),
        },
      });
      const service = new AuthService(prisma as unknown as PrismaService, devConfig);

      await expect(
        service.login({
          email: 'admin@denimflow.internal',
          password: 'password',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects login with 401 Unauthorized when profile not found', async () => {
      const prisma = createMockPrisma({
        profile: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      });
      const service = new AuthService(prisma as unknown as PrismaService, devConfig);

      await expect(
        service.login({
          email: 'nonexistent@denimflow.internal',
          password: 'password',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects local login in production when Supabase client is not ready', async () => {
      const prisma = createMockPrisma();
      const prodConfigWithoutSupabase: AppConfig = {
        NODE_ENV: 'production',
        PORT: 3000,
        DATABASE_URL: 'http://localhost:5432/mock',
        DIRECT_URL: 'http://localhost:5432/mock',
        CORS_ORIGINS: ['http://localhost:5173'],
      };

      // Constructor throws in production if Supabase keys are missing
      expect(
        () => new AuthService(prisma as unknown as PrismaService, prodConfigWithoutSupabase),
      ).toThrow();
    });
  });

  describe('getMe', () => {
    it('validates local token in development and returns profile', async () => {
      const prisma = createMockPrisma();
      const service = new AuthService(prisma as unknown as PrismaService, devConfig);

      const user = await service.getMe(`Bearer local-token-${mockProfile.id}`);
      expect(user.id).toBe(mockProfile.id);
      expect(user.role).toBe(Role.ADMIN);
    });

    it('throws 403 Forbidden when profile is inactive in getMe', async () => {
      const prisma = createMockPrisma({
        profile: {
          findUnique: vi.fn().mockResolvedValue({ ...mockProfile, isActive: false }),
        },
      });
      const service = new AuthService(prisma as unknown as PrismaService, devConfig);

      await expect(service.getMe(`Bearer local-token-${mockProfile.id}`)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws 401 Unauthorized for missing or malformed header', async () => {
      const prisma = createMockPrisma();
      const service = new AuthService(prisma as unknown as PrismaService, devConfig);

      await expect(service.getMe(undefined)).rejects.toThrow(UnauthorizedException);
      await expect(service.getMe('InvalidToken')).rejects.toThrow(UnauthorizedException);
    });

    it('rejects local-token- in production', async () => {
      const prisma = createMockPrisma();
      const service = new AuthService(prisma as unknown as PrismaService, prodConfig);

      // In production, local-token- must NOT bypass Supabase
      await expect(service.getMe(`Bearer local-token-${mockProfile.id}`)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
