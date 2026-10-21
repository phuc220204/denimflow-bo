import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { QcProfileType } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import type {
  CreateColorOptionDto,
  CreateFabricTypeDto,
  CreateStationDto,
  CreateStyleDto,
  CreateWashTypeDto,
  ToggleFabricColorRuleDto,
  UpdateColorOptionDto,
  UpdateFabricTypeDto,
  UpdateQcProfileDto,
  UpdateStationDto,
  UpdateStyleDto,
  UpdateWashTypeDto,
} from './catalog.dto.js';

type Uuid = `${string}-${string}-${string}-${string}-${string}`;

@Injectable()
export class CatalogService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

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
    const styles = await this.prisma.style.findMany({
      orderBy: { styleCode: 'asc' },
    });
    return styles.map(toStyleResponse);
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
          cutTolerancePercent: dto.cutTolerancePercent,
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

      return toStyleResponse(style);
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
          cutTolerancePercent: dto.cutTolerancePercent,
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

      return toStyleResponse(updated);
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

  // ==========================================
  // 6. FABRIC-COLOR MATRIX (BR-04, FR-02)
  // ==========================================

  async getMatrix() {
    const [fabrics, colors, rules] = await Promise.all([
      this.prisma.fabricType.findMany({ orderBy: { code: 'asc' } }),
      this.prisma.colorOption.findMany({ orderBy: { code: 'asc' } }),
      this.prisma.fabricColorRule.findMany(),
    ]);

    return {
      fabrics,
      colors,
      rules,
    };
  }

  async toggleMatrixRule(dto: ToggleFabricColorRuleDto, actorId?: string | null) {
    const fabricUuid = this.toUuid(dto.fabricTypeId);
    const colorUuid = this.toUuid(dto.colorId);

    const [fabric, color] = await Promise.all([
      this.prisma.fabricType.findUnique({ where: { id: fabricUuid } }),
      this.prisma.colorOption.findUnique({ where: { id: colorUuid } }),
    ]);

    if (!fabric) {
      throw new NotFoundException('Không tìm thấy loại vải');
    }
    if (!color) {
      throw new NotFoundException('Không tìm thấy màu sắc');
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.fabricColorRule.findUnique({
        where: {
          fabricTypeId_colorId: {
            fabricTypeId: fabricUuid,
            colorId: colorUuid,
          },
        },
      });

      const updated = await tx.fabricColorRule.upsert({
        where: {
          fabricTypeId_colorId: {
            fabricTypeId: fabricUuid,
            colorId: colorUuid,
          },
        },
        update: {
          isAllowed: dto.isAllowed,
        },
        create: {
          fabricTypeId: fabricUuid,
          colorId: colorUuid,
          isAllowed: dto.isAllowed,
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: 'FABRIC_COLOR_RULE',
          entityId: updated.id,
          action: 'TOGGLE_MATRIX',
          oldValue: existing ? { isAllowed: existing.isAllowed } : Prisma.JsonNull,
          newValue: {
            fabricCode: fabric.code,
            colorCode: color.code,
            isAllowed: dto.isAllowed,
          },
          actorId: this.toActorId(actorId),
        },
      });

      return updated;
    });
  }

  async getAllowedColors(fabricTypeId: string) {
    const fabricUuid = this.toUuid(fabricTypeId);
    const fabric = await this.prisma.fabricType.findUnique({ where: { id: fabricUuid } });
    if (!fabric) {
      throw new NotFoundException('Không tìm thấy loại vải');
    }

    const rules = await this.prisma.fabricColorRule.findMany({
      where: {
        fabricTypeId: fabricUuid,
        isAllowed: true,
      },
      include: {
        colorOption: true,
      },
      orderBy: {
        colorOption: { code: 'asc' },
      },
    });

    return rules.map((r) => r.colorOption);
  }

  // ==========================================
  // 7. QC PROFILES (BR-19, FR-28)
  // ==========================================

  async getQcProfiles(styleId: string) {
    const styleUuid = this.toUuid(styleId);
    const style = await this.prisma.style.findUnique({ where: { id: styleUuid } });
    if (!style) {
      throw new NotFoundException('Không tìm thấy kiểu dáng');
    }

    return this.prisma.qcProfile.findMany({
      where: { styleId: styleUuid },
      orderBy: { profileType: 'asc' },
    });
  }

  async updateQcProfile(
    styleId: string,
    profileType: QcProfileType,
    dto: UpdateQcProfileDto,
    actorId?: string | null,
  ) {
    const styleUuid = this.toUuid(styleId);
    const style = await this.prisma.style.findUnique({ where: { id: styleUuid } });
    if (!style) {
      throw new NotFoundException('Không tìm thấy kiểu dáng');
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.qcProfile.findUnique({
        where: {
          styleId_profileType: {
            styleId: styleUuid,
            profileType,
          },
        },
      });

      const updated = await tx.qcProfile.upsert({
        where: {
          styleId_profileType: {
            styleId: styleUuid,
            profileType,
          },
        },
        update: {
          maxShrinkagePercent: dto.maxShrinkagePercent,
          maxColorFadingLevel: dto.maxColorFadingLevel,
          isActive: dto.isActive !== undefined ? dto.isActive : true,
        },
        create: {
          styleId: styleUuid,
          profileType,
          maxShrinkagePercent: dto.maxShrinkagePercent,
          maxColorFadingLevel: dto.maxColorFadingLevel,
          isActive: dto.isActive !== undefined ? dto.isActive : true,
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: 'QC_PROFILE',
          entityId: updated.id,
          action: 'UPDATE_QC_PROFILE',
          oldValue: existing
            ? {
                maxShrinkagePercent: Number(existing.maxShrinkagePercent),
                maxColorFadingLevel: existing.maxColorFadingLevel,
                isActive: existing.isActive,
              }
            : Prisma.JsonNull,
          newValue: {
            styleCode: style.styleCode,
            profileType,
            maxShrinkagePercent: dto.maxShrinkagePercent,
            maxColorFadingLevel: dto.maxColorFadingLevel,
            isActive: updated.isActive,
          },
          actorId: this.toActorId(actorId),
        },
      });

      return updated;
    });
  }
}

// Prisma returns numeric(5,2) as a Decimal, which JSON would turn into a string; send a number.
function toStyleResponse<T extends { cutTolerancePercent: { toString(): string } }>(style: T) {
  return { ...style, cutTolerancePercent: Number(style.cutTolerancePercent.toString()) };
}
