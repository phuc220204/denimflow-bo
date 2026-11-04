import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { auditLogQuerySchema, Role } from '@denimflow/shared';
import { AuthGuard } from '../auth/auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { AuditService } from './audit.service.js';

// FR-25 (PRD §3): Admin may view the AuditLog, Manager may view it read-only.
@Controller('audit')
@UseGuards(AuthGuard)
@Roles(Role.ADMIN, Role.MANAGER)
export class AuditController {
  constructor(@Inject(AuditService) private readonly auditService: AuditService) {}

  @Get()
  getAuditLogs(@Query() rawQuery: unknown) {
    return this.auditService.findAuditLogs(auditLogQuerySchema.parse(rawQuery));
  }

  @Get('filter-options')
  getFilterOptions() {
    return this.auditService.getFilterOptions();
  }
}
