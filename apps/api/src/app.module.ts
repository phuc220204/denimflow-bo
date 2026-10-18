import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module.js';
import { PrismaModule } from './infrastructure/prisma/prisma.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { WorkflowModule } from './modules/workflow/workflow.module.js';

@Module({
  imports: [ConfigModule, PrismaModule, HealthModule, WorkflowModule],
})
export class AppModule {}
