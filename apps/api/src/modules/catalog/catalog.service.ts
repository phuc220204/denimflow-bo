import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import type {
  CreateColorOptionDto,
  CreateFabricTypeDto,
  CreateStationDto,
  CreateStyleDto,
  CreateWashTypeDto,
  UpdateColorOptionDto,
  UpdateFabricTypeDto,
  UpdateStationDto,
  UpdateStyleDto,
  UpdateWashTypeDto,
} from './catalog.dto.js';

type Uuid = `${string}-${string}-${string}-${string}-${string}`;

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  private toUuid(id: string): Uuid {
    return id as unknown as Uuid;
  }

  private toActorId(actorId?: string | null): Uuid | null {
    if (!actorId) return null;
    return actorId as unknown as Uuid;
  }

  // ==========================================
  // 1. STATIONS
  // ==========================================

  async getStations() {
    return this.prisma.station.findMany({
      orderBy: { code: 'asc' },
    });
  }

  async createStation(dto: CreateStationDto, actorId?: string | null) {
    const existing = await this.prisma.station.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new BadRequestException(`Mã trạm '${dto.code}' đã tồn tại trong hệ thống`);
    }

    return this.prisma.$transaction(async (tx) => {
      const station = await tx.station.create({
        data: {
          code: dto.code,
          name: dto.name,
          stationType: dto.stationType,
          isOutsourced: dto.isOutsourced,
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: 'STATION',
          entityId: this.toUuid(station.id),
          action: 'CREATE',
          newValue: station as unknown as Prisma.InputJsonValue,
          actorId: this.toActorId(actorId),
        },
      });

      return station;
    });
  }

  async updateStation(id: string, dto: UpdateStationDto, actorId?: string | null) {
    const uuid = this.toUuid(id);
    const existing = await this.prisma.station.findUnique({
      where: { id: uuid },
    });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy trạm cần cập nhật');
    }

    if (dto.code && dto.code !== existing.code) {
      const duplicate = await this.prisma.station.findUnique({
        where: { code: dto.code },
      });
      if (duplicate) {
        throw new BadRequestException(`Mã trạm '${dto.code}' đã tồn tại trong hệ thống`);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.station.update({
        where: { id: uuid },
        data: {
          code: dto.code,
          name: dto.name,
          stationType: dto.stationType,
          isOutsourced: dto.isOutsourced,
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: 'STATION',
          entityId: uuid,
          action: 'UPDATE',
          oldValue: existing as unknown as Prisma.InputJsonValue,
          newValue: updated as unknown as Prisma.InputJsonValue,
          actorId: this.toActorId(actorId),
        },
      });

      return updated;
    });
  }

  async deleteStation(id: string, actorId?: string | null) {
    const uuid = this.toUuid(id);
    const existing = await this.prisma.station.findUnique({
      where: { id: uuid },
    });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy trạm cần xóa');
    }

    // Check references before deleting
    const linkedProfiles = await this.prisma.profile.count({
      where: { stationId: uuid },
    });
    if (linkedProfiles > 0) {
      throw new BadRequestException(
        'Không thể xóa trạm vì đang có tài khoản nhân sự liên kết với trạm này',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const deleted = await tx.station.delete({
        where: { id: uuid },
      });

      await tx.auditLog.create({
        data: {
          entityType: 'STATION',
          entityId: uuid,
          action: 'DELETE',
          oldValue: existing as unknown as Prisma.InputJsonValue,
          actorId: this.toActorId(actorId),
        },
      });

      return deleted;
    });
  }

  // ==========================================
  // 2. STYLES
  // ==========================================

  async getStyles() {
    return this.prisma.style.findMany({
      orderBy: { styleCode: 'asc' },
    });
  }

  async createStyle(dto: CreateStyleDto, actorId?: string | null) {
    const existing = await this.prisma.style.findUnique({
      where: { styleCode: dto.styleCode },
    });
    if (existing) {
      throw new BadRequestException(`Mã kiểu dáng '${dto.styleCode}' đã tồn tại`);
    }

    return this.prisma.$transaction(async (tx) => {
      const style = await tx.style.create({
        data: {
          styleCode: dto.styleCode,
          name: dto.name,
          fitType: dto.fitType ?? null,
          hasEmbroidery: dto.hasEmbroidery,
          isActive: dto.isActive,
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: 'STYLE',
          entityId: this.toUuid(style.id),
          action: 'CREATE',
          newValue: style as unknown as Prisma.InputJsonValue,
          actorId: this.toActorId(actorId),
        },
      });

      return style;
    });
  }

  async updateStyle(id: string, dto: UpdateStyleDto, actorId?: string | null) {
    const uuid = this.toUuid(id);
    const existing = await this.prisma.style.findUnique({
      where: { id: uuid },
    });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy kiểu dáng cần cập nhật');
    }

    if (dto.styleCode && dto.styleCode !== existing.styleCode) {
      const duplicate = await this.prisma.style.findUnique({
        where: { styleCode: dto.styleCode },
      });
      if (duplicate) {
        throw new BadRequestException(`Mã kiểu dáng '${dto.styleCode}' đã tồn tại`);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.style.update({
        where: { id: uuid },
        data: {
          styleCode: dto.styleCode,
          name: dto.name,
          fitType: dto.fitType ?? undefined,
          hasEmbroidery: dto.hasEmbroidery,
          isActive: dto.isActive,
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: 'STYLE',
          entityId: uuid,
          action: 'UPDATE',
          oldValue: existing as unknown as Prisma.InputJsonValue,
          newValue: updated as unknown as Prisma.InputJsonValue,
          actorId: this.toActorId(actorId),
        },
      });

      return updated;
    });
  }

  async deleteStyle(id: string, actorId?: string | null) {
    const uuid = this.toUuid(id);
    const existing = await this.prisma.style.findUnique({
      where: { id: uuid },
    });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy kiểu dáng cần xóa');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const deleted = await tx.style.delete({
          where: { id: uuid },
        });

        await tx.auditLog.create({
          data: {
            entityType: 'STYLE',
            entityId: uuid,
            action: 'DELETE',
            oldValue: existing as unknown as Prisma.InputJsonValue,
            actorId: this.toActorId(actorId),
          },
        });

        return deleted;
      });
    } catch (err: unknown) {
      const error = err as { code?: string };
      if (error.code === 'P2003') {
        throw new BadRequestException(
          'Không thể xóa kiểu dáng này vì đang được tham chiếu bởi dữ liệu đơn hàng hoặc quy trình khác',
        );
      }
      throw err;
    }
  }

  // ==========================================
  // 3. FABRIC TYPES
  // ==========================================

  async getFabricTypes() {
    return this.prisma.fabricType.findMany({
      orderBy: { code: 'asc' },
    });
  }

  async createFabricType(dto: CreateFabricTypeDto, actorId?: string | null) {
    const existing = await this.prisma.fabricType.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new BadRequestException(`Mã loại vải '${dto.code}' đã tồn tại`);
    }

    return this.prisma.$transaction(async (tx) => {
      const fabric = await tx.fabricType.create({
        data: {
          code: dto.code,
          name: dto.name,
          weightOz: dto.weightOz ?? null,
          composition: dto.composition ?? null,
          stretchType: dto.stretchType,
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: 'FABRIC_TYPE',
          entityId: this.toUuid(fabric.id),
          action: 'CREATE',
          newValue: fabric as unknown as Prisma.InputJsonValue,
          actorId: this.toActorId(actorId),
        },
      });

      return fabric;
    });
  }

  async updateFabricType(id: string, dto: UpdateFabricTypeDto, actorId?: string | null) {
    const uuid = this.toUuid(id);
    const existing = await this.prisma.fabricType.findUnique({
      where: { id: uuid },
    });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy loại vải cần cập nhật');
    }

    if (dto.code && dto.code !== existing.code) {
      const duplicate = await this.prisma.fabricType.findUnique({
        where: { code: dto.code },
      });
      if (duplicate) {
        throw new BadRequestException(`Mã loại vải '${dto.code}' đã tồn tại`);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.fabricType.update({
        where: { id: uuid },
        data: {
          code: dto.code,
          name: dto.name,
          weightOz: dto.weightOz ?? undefined,
          composition: dto.composition ?? undefined,
          stretchType: dto.stretchType,
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: 'FABRIC_TYPE',
          entityId: uuid,
          action: 'UPDATE',
          oldValue: existing as unknown as Prisma.InputJsonValue,
          newValue: updated as unknown as Prisma.InputJsonValue,
          actorId: this.toActorId(actorId),
        },
      });

      return updated;
    });
  }

  async deleteFabricType(id: string, actorId?: string | null) {
    const uuid = this.toUuid(id);
    const existing = await this.prisma.fabricType.findUnique({
      where: { id: uuid },
    });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy loại vải cần xóa');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const deleted = await tx.fabricType.delete({
          where: { id: uuid },
        });

        await tx.auditLog.create({
          data: {
            entityType: 'FABRIC_TYPE',
            entityId: uuid,
            action: 'DELETE',
            oldValue: existing as unknown as Prisma.InputJsonValue,
            actorId: this.toActorId(actorId),
          },
        });

        return deleted;
      });
    } catch (err: unknown) {
      const error = err as { code?: string };
      if (error.code === 'P2003') {
        throw new BadRequestException(
          'Không thể xóa loại vải này vì đang được tham chiếu bởi dữ liệu đơn hàng hoặc quy trình khác',
        );
      }
      throw err;
    }
  }

  // ==========================================
  // 4. COLOR OPTIONS
  // ==========================================

  async getColorOptions() {
    return this.prisma.colorOption.findMany({
      orderBy: { code: 'asc' },
    });
  }

  async createColorOption(dto: CreateColorOptionDto, actorId?: string | null) {
    const existing = await this.prisma.colorOption.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new BadRequestException(`Mã màu '${dto.code}' đã tồn tại`);
    }

    return this.prisma.$transaction(async (tx) => {
      const color = await tx.colorOption.create({
        data: {
          code: dto.code,
          name: dto.name,
          colorFamily: dto.colorFamily ?? null,
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: 'COLOR_OPTION',
          entityId: this.toUuid(color.id),
          action: 'CREATE',
          newValue: color as unknown as Prisma.InputJsonValue,
          actorId: this.toActorId(actorId),
        },
      });

      return color;
    });
  }

  async updateColorOption(id: string, dto: UpdateColorOptionDto, actorId?: string | null) {
    const uuid = this.toUuid(id);
    const existing = await this.prisma.colorOption.findUnique({
      where: { id: uuid },
    });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy màu cần cập nhật');
    }

    if (dto.code && dto.code !== existing.code) {
      const duplicate = await this.prisma.colorOption.findUnique({
        where: { code: dto.code },
      });
      if (duplicate) {
        throw new BadRequestException(`Mã màu '${dto.code}' đã tồn tại`);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.colorOption.update({
        where: { id: uuid },
        data: {
          code: dto.code,
          name: dto.name,
          colorFamily: dto.colorFamily ?? undefined,
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: 'COLOR_OPTION',
          entityId: uuid,
          action: 'UPDATE',
          oldValue: existing as unknown as Prisma.InputJsonValue,
          newValue: updated as unknown as Prisma.InputJsonValue,
          actorId: this.toActorId(actorId),
        },
      });

      return updated;
    });
  }

  async deleteColorOption(id: string, actorId?: string | null) {
    const uuid = this.toUuid(id);
    const existing = await this.prisma.colorOption.findUnique({
      where: { id: uuid },
    });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy màu cần xóa');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const deleted = await tx.colorOption.delete({
          where: { id: uuid },
        });

        await tx.auditLog.create({
          data: {
            entityType: 'COLOR_OPTION',
            entityId: uuid,
            action: 'DELETE',
            oldValue: existing as unknown as Prisma.InputJsonValue,
            actorId: this.toActorId(actorId),
          },
        });

        return deleted;
      });
    } catch (err: unknown) {
      const error = err as { code?: string };
      if (error.code === 'P2003') {
        throw new BadRequestException(
          'Không thể xóa màu này vì đang được tham chiếu bởi dữ liệu đơn hàng hoặc quy trình khác',
        );
      }
      throw err;
    }
  }

  // ==========================================
  // 5. WASH TYPES
  // ==========================================

  async getWashTypes() {
    return this.prisma.washType.findMany({
      orderBy: { code: 'asc' },
    });
  }

  async createWashType(dto: CreateWashTypeDto, actorId?: string | null) {
    const existing = await this.prisma.washType.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new BadRequestException(`Mã kiểu giặt '${dto.code}' đã tồn tại`);
    }

    return this.prisma.$transaction(async (tx) => {
      const wash = await tx.washType.create({
        data: {
          code: dto.code,
          name: dto.name,
          description: dto.description ?? null,
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: 'WASH_TYPE',
          entityId: this.toUuid(wash.id),
          action: 'CREATE',
          newValue: wash as unknown as Prisma.InputJsonValue,
          actorId: this.toActorId(actorId),
        },
      });

      return wash;
    });
  }

  async updateWashType(id: string, dto: UpdateWashTypeDto, actorId?: string | null) {
    const uuid = this.toUuid(id);
    const existing = await this.prisma.washType.findUnique({
      where: { id: uuid },
    });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy kiểu giặt cần cập nhật');
    }

    if (dto.code && dto.code !== existing.code) {
      const duplicate = await this.prisma.washType.findUnique({
        where: { code: dto.code },
      });
      if (duplicate) {
        throw new BadRequestException(`Mã kiểu giặt '${dto.code}' đã tồn tại`);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.washType.update({
        where: { id: uuid },
        data: {
          code: dto.code,
          name: dto.name,
          description: dto.description ?? undefined,
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: 'WASH_TYPE',
          entityId: uuid,
          action: 'UPDATE',
          oldValue: existing as unknown as Prisma.InputJsonValue,
          newValue: updated as unknown as Prisma.InputJsonValue,
          actorId: this.toActorId(actorId),
        },
      });

      return updated;
    });
  }

  async deleteWashType(id: string, actorId?: string | null) {
    const uuid = this.toUuid(id);
    const existing = await this.prisma.washType.findUnique({
      where: { id: uuid },
    });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy kiểu giặt cần xóa');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const deleted = await tx.washType.delete({
          where: { id: uuid },
        });

        await tx.auditLog.create({
          data: {
            entityType: 'WASH_TYPE',
            entityId: uuid,
            action: 'DELETE',
            oldValue: existing as unknown as Prisma.InputJsonValue,
            actorId: this.toActorId(actorId),
          },
        });

        return deleted;
      });
    } catch (err: unknown) {
      const error = err as { code?: string };
      if (error.code === 'P2003') {
        throw new BadRequestException(
          'Không thể xóa kiểu giặt này vì đang được tham chiếu bởi dữ liệu đơn hàng hoặc quy trình khác',
        );
      }
      throw err;
    }
  }
}
