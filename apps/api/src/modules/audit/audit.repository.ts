import { Inject, Injectable } from '@nestjs/common';
import type { AuditLog, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

export interface AuditLogFilter {
  entityType?: string;
  entityId?: string;
  actorId?: string;
  from?: Date;
  to?: Date;
}

@Injectable()
export class AuditRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findPage(
    filter: AuditLogFilter,
    skip: number,
    take: number,
  ): Promise<{ total: number; rows: AuditLog[] }> {
    const where: Prisma.AuditLogWhereInput = {
      entityType: filter.entityType,
      entityId: filter.entityId,
      actorId: filter.actorId,
      createdAt: filter.from || filter.to ? { gte: filter.from, lte: filter.to } : undefined,
    };
    const [total, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        // Rows written in one transaction share created_at (Postgres now()); id keeps their order.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take,
      }),
    ]);
    return { total, rows };
  }

  // groupBy runs as SQL GROUP BY; findMany({ distinct }) would load every row first.
  async findEntityTypes(): Promise<string[]> {
    const groups = await this.prisma.auditLog.groupBy({
      by: ['entityType'],
      orderBy: { entityType: 'asc' },
    });
    return groups.map((group) => group.entityType);
  }
}
