import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';
import { AuditController } from './audit.controller.js';
import { AuditRepository } from './audit.repository.js';
import { AuditService } from './audit.service.js';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule],
  controllers: [AuditController],
  providers: [AuditRepository, AuditService],
  exports: [AuditService],
})
export class AuditModule {}
