import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ExecutionController } from './execution.controller.js';
import { ExecutionRepository } from './execution.repository.js';
import { ExecutionService } from './execution.service.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ExecutionController],
  providers: [ExecutionRepository, ExecutionService],
  exports: [ExecutionService],
})
export class ExecutionModule {}
