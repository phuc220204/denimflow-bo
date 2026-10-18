import { Controller, ForbiddenException, Get, Headers, Inject, Query } from '@nestjs/common';
import { Role, auditLogQuerySchema } from '@denimflow/shared';
import { AuthService } from '../auth/auth.service.js';
import { AuditService } from './audit.service.js';

@Controller('audit')
export class AuditController {
  constructor(
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject(AuthService) private readonly authService: AuthService,
  ) {}

  @Get()
  async getAuditLogs(@Query() rawQuery: unknown, @Headers('authorization') authHeader?: string) {
    const user = await this.authService.getMe(authHeader);
    if (user.role !== Role.ADMIN && user.role !== Role.MANAGER) {
      throw new ForbiddenException(
        'Chỉ Quản trị viên (ADMIN) và Quản lý xưởng (MANAGER) mới có quyền xem nhật ký hệ thống.',
      );
    }
    const query = auditLogQuerySchema.parse(rawQuery);
    return this.auditService.findAuditLogs(query);
  }
}
