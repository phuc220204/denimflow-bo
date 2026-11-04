import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { WorkflowController } from './workflow.controller.js';
import { WorkflowRepository } from './workflow.repository.js';
import { WorkflowService } from './workflow.service.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [WorkflowController],
  providers: [WorkflowService, WorkflowRepository],
  exports: [WorkflowService],
})
export class WorkflowModule {}
