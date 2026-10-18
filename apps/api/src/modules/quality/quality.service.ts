import { Inject, Injectable } from '@nestjs/common';
import type {
  EvaluateQcInspectionInputDto,
  QcEvaluationOutputDto,
  QcInspectionResponseDto,
  RecordQcInspectionDto,
  ReworkTargetDto,
} from '@denimflow/shared';
import { QualityRepository } from './quality.repository.js';

@Injectable()
export class QualityService {
  constructor(@Inject(QualityRepository) private readonly qualityRepository: QualityRepository) {}

  async evaluateInspection(
    stepInstanceId: string,
    input: EvaluateQcInspectionInputDto,
  ): Promise<QcEvaluationOutputDto> {
    return this.qualityRepository.evaluateInspection(stepInstanceId, input);
  }

  async recordInspection(
    input: RecordQcInspectionDto,
    actorId: string,
    actorRole: string,
  ): Promise<QcInspectionResponseDto> {
    return this.qualityRepository.recordInspection(input, actorId, actorRole);
  }

  async getInspections(stepInstanceId: string): Promise<QcInspectionResponseDto[]> {
    return this.qualityRepository.getInspections(stepInstanceId);
  }

  async getReworkTargets(stepInstanceId: string): Promise<ReworkTargetDto[]> {
    return this.qualityRepository.getReworkTargets(stepInstanceId);
  }
}
