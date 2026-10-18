import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { QualityController } from './quality.controller.js';
import { QualityRepository } from './quality.repository.js';
import { QualityService } from './quality.service.js';

@Module({
  imports: [AuthModule],
  controllers: [QualityController],
  providers: [QualityRepository, QualityService],
  exports: [QualityService],
})
export class QualityModule {}
