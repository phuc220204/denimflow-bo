import { describe, expect, it, vi } from 'vitest';
import { createStepDefinitionSchema } from './dto/index.js';
import { BusinessRuleViolation } from '../../common/errors/business-rule-violation.js';
import type { WorkflowRepository } from './workflow.repository.js';
import { WorkflowService } from './workflow.service.js';

type VersionWithRelations = NonNullable<Awaited<ReturnType<WorkflowRepository['findVersionById']>>>;
type StepWithRelations = NonNullable<Awaited<ReturnType<WorkflowRepository['findStepById']>>>;
type TransitionWithRelations = NonNullable<
  Awaited<ReturnType<WorkflowRepository['findTransitionById']>>
>;

describe('WorkflowService (T2.4, FR-04, FR-05, BR-01, BR-02)', () => {
  const mockRepository = {
    listTemplates: vi.fn(),
    findTemplateById: vi.fn(),
    createTemplateWithInitialVersion: vi.fn(),
    findVersionById: vi.fn(),
    findLatestVersionForTemplate: vi.fn(),
    createVersionCloningPrevious: vi.fn(),
    createStep: vi.fn(),
    findStepById: vi.fn(),
    updateStep: vi.fn(),
    deleteStep: vi.fn(),
    createTransition: vi.fn(),
    findTransitionById: vi.fn(),
    deleteTransition: vi.fn(),
    publishVersionTransaction: vi.fn(),
    assignTemplateToStyle: vi.fn(),
  } as unknown as WorkflowRepository;

  const service = new WorkflowService(mockRepository);

  describe('BR-02: Draft-only mutations on steps and transitions', () => {
    it('rejects adding a step to a PUBLISHED version', async () => {
      vi.mocked(mockRepository.findVersionById).mockResolvedValueOnce({
        id: 'v1',
        templateId: 't1',
        status: 'PUBLISHED',
        steps: [],
        transitions: [],
      } as unknown as VersionWithRelations);

      const dto = createStepDefinitionSchema.parse({
        code: 'TEST_STEP',
        name: 'Test Step',
        stepType: 'PRODUCTION',
        seq: 1,
        responsibleRole: 'STATION_OPERATOR',
      });

      await expect(service.addStep('v1', dto)).rejects.toThrow(BusinessRuleViolation);
    });

    it('rejects updating a step in a PUBLISHED version', async () => {
      vi.mocked(mockRepository.findStepById).mockResolvedValueOnce({
        id: 's1',
        versionId: 'v1',
        version: { status: 'PUBLISHED' },
      } as unknown as StepWithRelations);

      await expect(service.updateStep('s1', { name: 'Updated' })).rejects.toThrow(
        BusinessRuleViolation,
      );
    });

    it('rejects deleting a step in a PUBLISHED version', async () => {
      vi.mocked(mockRepository.findStepById).mockResolvedValueOnce({
        id: 's1',
        versionId: 'v1',
        version: { status: 'PUBLISHED' },
      } as unknown as StepWithRelations);

      await expect(service.deleteStep('s1')).rejects.toThrow(BusinessRuleViolation);
    });

    it('rejects adding a transition to a PUBLISHED version', async () => {
      vi.mocked(mockRepository.findVersionById).mockResolvedValueOnce({
        id: 'v1',
        templateId: 't1',
        status: 'PUBLISHED',
        steps: [],
        transitions: [],
      } as unknown as VersionWithRelations);

      await expect(
        service.addTransition('v1', {
          fromStepId: '123e4567-e89b-12d3-a456-426614174000',
          toStepId: '123e4567-e89b-12d3-a456-426614174001',
          kind: 'NORMAL',
        }),
      ).rejects.toThrow(BusinessRuleViolation);
    });

    it('rejects deleting a transition in a RETIRED version', async () => {
      vi.mocked(mockRepository.findTransitionById).mockResolvedValueOnce({
        id: 'tr1',
        versionId: 'v1',
        version: { status: 'RETIRED' },
      } as unknown as TransitionWithRelations);

      await expect(service.deleteTransition('tr1')).rejects.toThrow(BusinessRuleViolation);
    });
  });

  describe('BR-01 & BR-02: Publishing workflow version', () => {
    it('rejects publishing a version that is not in DRAFT status', async () => {
      vi.mocked(mockRepository.findVersionById).mockResolvedValueOnce({
        id: 'v1',
        templateId: 't1',
        status: 'PUBLISHED',
        steps: [],
        transitions: [],
      } as unknown as VersionWithRelations);

      await expect(service.publishVersion('v1')).rejects.toThrow(
        'Only DRAFT versions can be published',
      );
    });

    it('rejects publishing an invalid template and returns violation list', async () => {
      // Version has NO end step -> violates BR-01
      vi.mocked(mockRepository.findVersionById).mockResolvedValueOnce({
        id: 'v1',
        templateId: 't1',
        status: 'DRAFT',
        template: { name: 'Invalid Template' },
        steps: [
          {
            id: 's1',
            code: 'START',
            name: 'Start',
            stepType: 'APPROVAL',
            seq: 1,
            isStart: true,
            isEnd: false, // NO END STEP
          },
        ],
        transitions: [],
      } as unknown as VersionWithRelations);

      try {
        await service.publishVersion('v1');
        expect.unreachable('Should have thrown BusinessRuleViolation');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(BusinessRuleViolation);
        const brError = error as BusinessRuleViolation & {
          details?: { violations?: Array<{ code: string }> };
        };
        expect(brError.brId).toBe('BR-01');
        expect(brError.details?.violations).toBeDefined();
        expect(brError.details?.violations?.some((v) => v.code === 'NO_END_STEP')).toBe(true);
      }

      // Ensure repository publish transaction was NEVER called
      expect(mockRepository.publishVersionTransaction).not.toHaveBeenCalled();
    });

    it('successfully publishes a valid DRAFT template through transaction', async () => {
      // Valid minimal workflow: Start -> End
      vi.mocked(mockRepository.findVersionById).mockResolvedValueOnce({
        id: 'v1',
        templateId: 't1',
        status: 'DRAFT',
        template: { name: 'Valid Template' },
        steps: [
          {
            id: 's1',
            code: 'START',
            name: 'Start Step',
            stepType: 'APPROVAL',
            seq: 1,
            isStart: true,
            isEnd: false,
          },
          {
            id: 's2',
            code: 'END',
            name: 'End Step',
            stepType: 'PRODUCTION',
            seq: 2,
            isStart: false,
            isEnd: true,
          },
        ],
        transitions: [{ id: 'tr1', fromStepId: 's1', toStepId: 's2', kind: 'NORMAL' }],
      } as unknown as VersionWithRelations);

      vi.mocked(mockRepository.publishVersionTransaction).mockResolvedValueOnce({
        id: 'v1',
        templateId: 't1',
        versionNo: 1,
        status: 'PUBLISHED',
      } as unknown as VersionWithRelations);

      const published = await service.publishVersion('v1', 'actor-uuid');
      expect(published.status).toBe('PUBLISHED');
      expect(mockRepository.publishVersionTransaction).toHaveBeenCalledWith(
        'v1',
        't1',
        'actor-uuid',
      );
    });
  });

  describe('Style assignment', () => {
    it('assigns template to style', async () => {
      vi.mocked(mockRepository.findTemplateById).mockResolvedValueOnce({
        id: 't1',
        name: 'Jean Standard',
      } as unknown as NonNullable<Awaited<ReturnType<WorkflowRepository['findTemplateById']>>>);

      vi.mocked(mockRepository.assignTemplateToStyle).mockResolvedValueOnce({
        id: 'style-uuid',
        defaultTemplateId: 't1',
      } as unknown as NonNullable<
        Awaited<ReturnType<WorkflowRepository['assignTemplateToStyle']>>
      >);

      const result = await service.assignTemplateToStyle({
        styleId: '123e4567-e89b-12d3-a456-426614174000',
        templateId: 't1',
      });

      expect(result.defaultTemplateId).toBe('t1');
      expect(mockRepository.assignTemplateToStyle).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174000',
        't1',
        undefined,
      );
    });
  });
});
