import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { EvidenceController } from './evidence.controller.js';
import { EvidenceService } from './evidence.service.js';
import { EvidenceStorage } from './evidence-storage.js';
import { ExecutionController } from './execution.controller.js';
import { ExecutionRepository } from './execution.repository.js';
import { ExecutionService } from './execution.service.js';
import { QuantityService } from './quantity.service.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ExecutionController, EvidenceController],
  providers: [
    ExecutionRepository,
    ExecutionService,
    QuantityService,
    EvidenceService,
    EvidenceStorage,
  ],
  exports: [ExecutionService, ExecutionRepository, EvidenceService],
})
export class ExecutionModule {}
