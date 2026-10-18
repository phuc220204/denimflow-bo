import { Inject, Injectable } from '@nestjs/common';
import type {
  CompleteStepResponseDto,
  StartStepResponseDto,
  WorklistItemDto,
  WorklistQueryDto,
} from '@denimflow/shared';
import { ExecutionRepository } from './execution.repository.js';

@Injectable()
export class ExecutionService {
  constructor(
    @Inject(ExecutionRepository) private readonly executionRepository: ExecutionRepository,
  ) {}

  async getWorklist(userId: string, query?: WorklistQueryDto): Promise<WorklistItemDto[]> {
    return this.executionRepository.getWorklist(userId, query);
  }

  async startStep(
    stepId: string,
    actorId: string,
    actorRole: string,
  ): Promise<StartStepResponseDto> {
    return this.executionRepository.startStep(stepId, actorId, actorRole);
  }

  async completeStep(
    stepId: string,
    actorId: string,
    actorRole: string,
  ): Promise<CompleteStepResponseDto> {
    return this.executionRepository.completeStep(stepId, actorId, actorRole);
  }
}
