import { Inject, Injectable } from '@nestjs/common';
import type {
  AuditLogFilterOptionsDto,
  AuditLogListResponseDto,
  AuditLogQueryDto,
} from '@denimflow/shared';
import { UsersService } from '../users/users.service.js';
import { AuditRepository } from './audit.repository.js';

// FR-25: read-only view of the append-only audit trail (BR-16).
@Injectable()
export class AuditService {
  constructor(
    @Inject(AuditRepository) private readonly auditRepository: AuditRepository,
    // Actor names come from the users module's service, not from the profiles table (rule 01).
    @Inject(UsersService) private readonly usersService: UsersService,
  ) {}

  async findAuditLogs(query: AuditLogQueryDto): Promise<AuditLogListResponseDto> {
    const { page, limit } = query;
    const [{ total, rows }, users] = await Promise.all([
      this.auditRepository.findPage(
        {
          entityType: query.entityType,
          entityId: query.entityId,
          actorId: query.actorId,
          from: query.from ? new Date(query.from) : undefined,
          to: query.to ? new Date(query.to) : undefined,
        },
        (page - 1) * limit,
        limit,
      ),
      this.usersService.getUsers(),
    ]);
    const usersById = new Map(users.map((user) => [user.id, user]));

    return {
      items: rows.map((row) => {
        const actor = row.actorId ? usersById.get(row.actorId) : undefined;
        return {
          id: row.id.toString(),
          entityType: row.entityType,
          entityId: row.entityId,
          action: row.action,
          oldValue: row.oldValue,
          newValue: row.newValue,
          actorId: row.actorId,
          actorName: actor?.fullName ?? null,
          actorEmail: actor?.email ?? null,
          createdAt: row.createdAt.toISOString(),
        };
      }),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getFilterOptions(): Promise<AuditLogFilterOptionsDto> {
    const [entityTypes, users] = await Promise.all([
      this.auditRepository.findEntityTypes(),
      this.usersService.getUsers(),
    ]);
    return {
      entityTypes,
      actors: users
        .map(({ id, fullName, email }) => ({ id, fullName, email }))
        .sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi')),
    };
  }
}
