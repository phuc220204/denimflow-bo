import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { AuditLogListResponseDto, AuditLogQueryDto } from '@denimflow/shared';

@Injectable()
export class AuditRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findAuditLogs(query: AuditLogQueryDto): Promise<AuditLogListResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: {
      entityType?: string;
      entityId?: string;
      actorId?: string;
      createdAt?: { gte?: Date; lte?: Date };
    } = {};

    if (query.entityType) {
      where.entityType = query.entityType;
    }
    if (query.entityId) {
      where.entityId = query.entityId;
    }
    if (query.actorId) {
      where.actorId = query.actorId;
    }
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) {
        where.createdAt.gte = new Date(query.from);
      }
      if (query.to) {
        where.createdAt.lte = new Date(query.to);
      }
    }

    const [total, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const actorIds = Array.from(
      new Set(rows.map((r) => r.actorId).filter((id): id is string => Boolean(id))),
    );

    const profiles =
      actorIds.length > 0
        ? await this.prisma.profile.findMany({
            where: { id: { in: actorIds } },
            select: { id: true, fullName: true, email: true },
          })
        : [];

    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    const items = rows.map((row) => {
      const profile = row.actorId ? profileMap.get(row.actorId) : undefined;
      return {
        id: row.id.toString(),
        entityType: row.entityType,
        entityId: row.entityId,
        action: row.action,
        oldValue: row.oldValue,
        newValue: row.newValue,
        actorId: row.actorId,
        actorName: profile ? profile.fullName : null,
        actorEmail: profile ? profile.email : null,
        createdAt: row.createdAt.toISOString(),
      };
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }
}
