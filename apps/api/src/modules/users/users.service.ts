import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { APP_CONFIG, type AppConfig } from '../../config/env.schema.js';
import { Role } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import type { CreateUserDto, UpdateUserAssignmentDto, UpdateUserStatusDto } from './users.dto.js';

type Uuid = `${string}-${string}-${string}-${string}-${string}`;

@Injectable()
export class UsersService {
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
    }
  }

  private toUuid(id: string): Uuid {
    return id as unknown as Uuid;
  }

  private toActorId(actorId?: string | null): Uuid | null {
    if (!actorId) return null;
    return actorId as unknown as Uuid;
  }

  async getUsers() {
    const profiles = await this.prisma.profile.findMany({
      include: {
        station: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
      orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
    });

    return profiles.map((p) => ({
      id: p.id,
      email: p.email,
      fullName: p.fullName,
      role: p.role,
      stationId: p.stationId,
      stationName: p.station ? `${p.station.code} - ${p.station.name}` : null,
      isActive: p.isActive,
      createdAt: p.createdAt,
    }));
  }

  async createUser(dto: CreateUserDto, actorId?: string | null) {
    const existing = await this.prisma.profile.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new BadRequestException(`Địa chỉ email '${dto.email}' đã được đăng ký trong hệ thống`);
    }

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
        throw new BadRequestException(
          error.message || 'Không thể tạo tài khoản trên dịch vụ xác thực',
        );
      }

      userId = data.user.id;
    }

    const uuid = this.toUuid(userId);
    const role = dto.role as Role;
    const stationId = dto.stationId ? this.toUuid(dto.stationId) : null;

    if (stationId) {
      const station = await this.prisma.station.findUnique({ where: { id: stationId } });
      if (!station) {
        throw new BadRequestException('Trạm làm việc được chỉ định không tồn tại');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.profile.create({
        data: {
          id: uuid,
          email: dto.email,
          fullName: dto.fullName,
          role,
          stationId,
          isActive: true,
        },
        include: {
          station: {
            select: { id: true, code: true, name: true },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: 'PROFILE',
          entityId: uuid,
          action: 'CREATE_USER',
          newValue: {
            email: dto.email,
            fullName: dto.fullName,
            role: dto.role,
            stationId: dto.stationId ?? null,
          },
          actorId: this.toActorId(actorId),
        },
      });

      return {
        id: created.id,
        email: created.email,
        fullName: created.fullName,
        role: created.role,
        stationId: created.stationId,
        stationName: created.station ? `${created.station.code} - ${created.station.name}` : null,
        isActive: created.isActive,
        createdAt: created.createdAt,
      };
    });
  }

  async updateStatus(id: string, dto: UpdateUserStatusDto, actorId?: string | null) {
    const uuid = this.toUuid(id);
    const existing = await this.prisma.profile.findUnique({
      where: { id: uuid },
    });

    if (!existing) {
      throw new NotFoundException('Không tìm thấy tài khoản nhân viên');
    }

    // Safety: prevent deactivating the last active ADMIN
    if (existing.role === Role.ADMIN && !dto.isActive) {
      const activeAdminCount = await this.prisma.profile.count({
        where: { role: Role.ADMIN, isActive: true },
      });
      if (activeAdminCount <= 1) {
        throw new BadRequestException(
          'Không thể khóa tài khoản Quản trị viên (Admin) duy nhất đang hoạt động',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.profile.update({
        where: { id: uuid },
        data: {
          isActive: dto.isActive,
        },
        include: {
          station: {
            select: { id: true, code: true, name: true },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: 'PROFILE',
          entityId: uuid,
          action: dto.isActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
          oldValue: { isActive: existing.isActive },
          newValue: { isActive: dto.isActive },
          actorId: this.toActorId(actorId),
        },
      });

      return {
        id: updated.id,
        email: updated.email,
        fullName: updated.fullName,
        role: updated.role,
        stationId: updated.stationId,
        stationName: updated.station ? `${updated.station.code} - ${updated.station.name}` : null,
        isActive: updated.isActive,
        createdAt: updated.createdAt,
      };
    });
  }

  async updateAssignment(id: string, dto: UpdateUserAssignmentDto, actorId?: string | null) {
    const uuid = this.toUuid(id);
    const existing = await this.prisma.profile.findUnique({
      where: { id: uuid },
    });

    if (!existing) {
      throw new NotFoundException('Không tìm thấy tài khoản nhân viên');
    }

    // Safety: prevent demoting/changing role of the last active ADMIN
    if (existing.role === Role.ADMIN && dto.role && dto.role !== Role.ADMIN) {
      const activeAdminCount = await this.prisma.profile.count({
        where: { role: Role.ADMIN, isActive: true },
      });
      if (activeAdminCount <= 1) {
        throw new BadRequestException(
          'Không thể chuyển vai trò của Quản trị viên (Admin) duy nhất đang hoạt động',
        );
      }
    }

    // Validate station existence if stationId is provided (not null/undefined)
    let stationUuid: Uuid | null = null;
    if (dto.stationId) {
      stationUuid = this.toUuid(dto.stationId);
      const station = await this.prisma.station.findUnique({
        where: { id: stationUuid },
      });
      if (!station) {
        throw new NotFoundException('Trạm làm việc không tồn tại trong danh mục xưởng');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const newStationId =
        dto.stationId !== undefined ? (dto.stationId ? stationUuid : null) : existing.stationId;
      const newRole = dto.role ? (dto.role as Role) : existing.role;

      const updated = await tx.profile.update({
        where: { id: uuid },
        data: {
          role: newRole,
          stationId: newStationId,
        },
        include: {
          station: {
            select: { id: true, code: true, name: true },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: 'PROFILE',
          entityId: uuid,
          action: 'ASSIGN_USER',
          oldValue: { role: existing.role, stationId: existing.stationId },
          newValue: { role: updated.role, stationId: updated.stationId },
          actorId: this.toActorId(actorId),
        },
      });

      return {
        id: updated.id,
        email: updated.email,
        fullName: updated.fullName,
        role: updated.role,
        stationId: updated.stationId,
        stationName: updated.station ? `${updated.station.code} - ${updated.station.name}` : null,
        isActive: updated.isActive,
        createdAt: updated.createdAt,
      };
    });
  }
}
