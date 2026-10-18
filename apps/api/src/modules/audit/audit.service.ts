import { Inject, Injectable } from '@nestjs/common';
import { AuditLogListResponseDto, AuditLogQueryDto } from '@denimflow/shared';
import { AuditRepository } from './audit.repository.js';

@Injectable()
export class AuditService {
  constructor(@Inject(AuditRepository) private readonly auditRepository: AuditRepository) {}

  async findAuditLogs(query: AuditLogQueryDto): Promise<AuditLogListResponseDto> {
    return this.auditRepository.findAuditLogs(query);
  }
}
