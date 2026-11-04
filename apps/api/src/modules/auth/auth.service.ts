import {
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { APP_CONFIG, type AppConfig } from '../../config/env.schema.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { type LoginDto } from './auth.dto.js';

type Uuid = `${string}-${string}-${string}-${string}-${string}`;

const AUTH_NOT_CONFIGURED =
  'Dịch vụ xác thực chưa được cấu hình (thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY)';

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
    @Inject(PrismaService) private readonly prisma: PrismaService,
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
    } else if (this.config.NODE_ENV === 'production') {
      throw new Error(
        'SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY bắt buộc phải được cấu hình trong môi trường production',
      );
    }
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    // Every login goes through Supabase Auth. There is no local fallback: a password-less
    // path would be a back door whenever the Supabase variables are missing.
    if (this.supabase) {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email: dto.email,
        password: dto.password,
      });

      if (error || !data.user || !data.session) {
        throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
      }

      const uuid = data.user.id as unknown as Uuid;
      const profile = await this.prisma.profile.findUnique({
        where: { id: uuid },
      });

      // Do not trust client user_metadata and do not auto-create profile.
      // Profiles must be created by Admin via POST /users.
      if (!profile) {
        throw new UnauthorizedException(
          'Tài khoản chưa được cấp hồ sơ nhân sự hoặc chưa được kích hoạt bởi Quản trị viên',
        );
      }

      if (!profile.isActive) {
        throw new ForbiddenException('Tài khoản đã bị tạm khóa bởi Quản trị viên');
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

    throw new ServiceUnavailableException(AUTH_NOT_CONFIGURED);
  }

  async getMe(authHeader?: string): Promise<AuthResponse['user']> {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Thiếu token xác thực');
    }

    const token = authHeader.replace('Bearer ', '').trim();

    if (!this.supabase) {
      throw new ServiceUnavailableException(AUTH_NOT_CONFIGURED);
    }

    // The token is verified by Supabase; the role always comes from `profiles` (AGENTS.md rule 7).
    const { data, error } = await this.supabase.auth.getUser(token);
    if (error || !data.user) {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ hoặc đã hết hạn');
    }

    const uuid = data.user.id as unknown as Uuid;
    const profile = await this.prisma.profile.findUnique({
      where: { id: uuid },
    });

    if (!profile) {
      throw new UnauthorizedException('Tài khoản không tồn tại trong hệ thống');
    }
    if (!profile.isActive) {
      throw new ForbiddenException('Tài khoản đã bị tạm khóa bởi Quản trị viên');
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
