import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { APP_CONFIG, type AppConfig } from '../../config/env.schema.js';
import { Role } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { type LoginDto, type RegisterDto } from './auth.dto.js';

type Uuid = `${string}-${string}-${string}-${string}-${string}`;

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    isActive: boolean;
  };
}

@Injectable()
export class AuthService {
  private readonly supabase: SupabaseClient | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {
    if (this.config.SUPABASE_URL && this.config.SUPABASE_SERVICE_ROLE_KEY) {
      this.supabase = createClient(
        this.config.SUPABASE_URL,
        this.config.SUPABASE_SERVICE_ROLE_KEY,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        },
      );
    }
  }

  async register(dto: RegisterDto): Promise<AuthResponse> {
    let userId: string = randomUUID();

    if (this.supabase) {
      const { data, error } = await this.supabase.auth.admin.createUser({
        email: dto.email,
        password: dto.password,
        email_confirm: true,
        user_metadata: {
          full_name: dto.fullName,
          role: dto.role,
        },
      });

      if (error) {
        throw new BadRequestException(error.message || 'Không thể tạo tài khoản');
      }

      userId = data.user.id;
    }

    const uuid = userId as unknown as Uuid;
    const role = dto.role as Role;

    // Atomic transaction for profile and audit log (rule 05 & BR-16)
    const profile = await this.prisma.$transaction(async (tx) => {
      const created = await tx.profile.create({
        data: {
          id: uuid,
          email: dto.email,
          fullName: dto.fullName,
          role,
          isActive: true,
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: 'PROFILE',
          entityId: uuid,
          action: 'REGISTER',
          newValue: {
            email: dto.email,
            fullName: dto.fullName,
            role: dto.role,
          },
        },
      });

      return created;
    });

    let accessToken = `token-${userId}`;
    if (this.supabase) {
      const { data: loginData } = await this.supabase.auth.signInWithPassword({
        email: dto.email,
        password: dto.password,
      });
      if (loginData?.session) {
        accessToken = loginData.session.access_token;
      }
    }

    return {
      accessToken,
      user: {
        id: profile.id,
        email: profile.email,
        fullName: profile.fullName,
        role: profile.role,
        isActive: profile.isActive,
      },
    };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    if (this.supabase) {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email: dto.email,
        password: dto.password,
      });

      if (error || !data.user || !data.session) {
        throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
      }

      const uuid = data.user.id as unknown as Uuid;
      let profile = await this.prisma.profile.findUnique({
        where: { id: uuid },
      });

      if (!profile) {
        // Self-heal profile from metadata if missing
        const fallbackRole = ((data.user.user_metadata?.role as Role) ||
          Role.PRODUCTION_PLANNER) as Role;
        profile = await this.prisma.profile.create({
          data: {
            id: uuid,
            email: dto.email,
            fullName: data.user.user_metadata?.full_name || dto.email.split('@')[0],
            role: fallbackRole,
            isActive: true,
          },
        });
      }

      if (!profile.isActive) {
        throw new UnauthorizedException('Tài khoản đã bị tạm khóa');
      }

      return {
        accessToken: data.session.access_token,
        user: {
          id: profile.id,
          email: profile.email,
          fullName: profile.fullName,
          role: profile.role,
          isActive: profile.isActive,
        },
      };
    }

    // Local fallback when Supabase is not configured
    const profile = await this.prisma.profile.findUnique({
      where: { email: dto.email },
    });

    if (!profile) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    return {
      accessToken: `local-token-${profile.id}`,
      user: {
        id: profile.id,
        email: profile.email,
        fullName: profile.fullName,
        role: profile.role,
        isActive: profile.isActive,
      },
    };
  }

  async getMe(authHeader?: string): Promise<AuthResponse['user']> {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Thiếu token xác thực');
    }

    const token = authHeader.replace('Bearer ', '').trim();

    if (this.supabase) {
      const { data, error } = await this.supabase.auth.getUser(token);
      if (error || !data.user) {
        throw new UnauthorizedException('Phiên đăng nhập đã hết hạn');
      }

      const uuid = data.user.id as unknown as Uuid;
      const profile = await this.prisma.profile.findUnique({
        where: { id: uuid },
      });

      if (!profile || !profile.isActive) {
        throw new UnauthorizedException('Tài khoản không tồn tại hoặc đã bị khóa');
      }

      return {
        id: profile.id,
        email: profile.email,
        fullName: profile.fullName,
        role: profile.role,
        isActive: profile.isActive,
      };
    }

    // Local mock token fallback
    const id = token.replace('local-token-', '') as unknown as Uuid;
    const profile = await this.prisma.profile.findFirst({
      where: { id },
    });

    if (!profile) {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');
    }

    return {
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      role: profile.role,
      isActive: profile.isActive,
    };
  }
}
