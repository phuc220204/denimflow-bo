import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ExecutionModule } from '../execution/execution.module.js';
import { QualityController } from './quality.controller.js';
import { QualityRepository } from './quality.repository.js';
import { QualityService } from './quality.service.js';

@Module({
  imports: [PrismaModule, AuthModule, ExecutionModule],
  controllers: [QualityController],
  providers: [QualityRepository, QualityService],
})
export class QualityModule {}
