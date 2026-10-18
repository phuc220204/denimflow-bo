import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ExecutionController } from './execution.controller.js';
import { ExecutionRepository } from './execution.repository.js';
import { ExecutionService } from './execution.service.js';
import { QuantityService } from './quantity.service.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ExecutionController],
  providers: [ExecutionRepository, ExecutionService, QuantityService],
  exports: [ExecutionService],
})
export class ExecutionModule {}
