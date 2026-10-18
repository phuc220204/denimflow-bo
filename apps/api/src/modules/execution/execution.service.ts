import { Inject, Injectable } from '@nestjs/common';
import type {
  AttachEvidenceDto,
  BundleDto,
  CompleteStepResponseDto,
  EvidenceDto,
  RecordQuantityEntryDto,
  StartStepResponseDto,
  StepQuantityEntryDto,
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

  async recordQuantity(
    stepId: string,
    input: RecordQuantityEntryDto,
    actorId: string,
    actorRole: string,
  ): Promise<StepQuantityEntryDto> {
    return this.executionRepository.recordQuantity(stepId, input, actorId, actorRole);
  }

  async generateBundles(stepId: string, actorId: string): Promise<BundleDto[]> {
    return this.executionRepository.generateBundles(stepId, actorId);
  }

  async getBundles(stepId: string): Promise<BundleDto[]> {
    return this.executionRepository.getBundles(stepId);
  }

  async getQuantityEntries(stepId: string): Promise<StepQuantityEntryDto[]> {
    return this.executionRepository.getQuantityEntries(stepId);
  }

  async attachEvidence(
    stepId: string,
    input: AttachEvidenceDto,
    actorId: string,
  ): Promise<EvidenceDto> {
    return this.executionRepository.attachEvidence(stepId, input, actorId);
  }

  async getEvidence(stepId: string): Promise<EvidenceDto[]> {
    return this.executionRepository.getEvidence(stepId);
  }
}
