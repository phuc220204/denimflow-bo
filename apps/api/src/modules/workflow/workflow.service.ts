import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { validateTemplate, type WorkflowTemplateDefinition } from '@denimflow/engine';
import { BusinessRuleViolation } from '../../common/errors/business-rule-violation.js';
import {
  type AssignTemplateToStyleDto,
  type CreateStepDefinitionDto,
  type CreateStepTransitionDto,
  type CreateWorkflowTemplateDto,
  type UpdateStepDefinitionDto,
} from './dto/index.js';
import { WorkflowRepository } from './workflow.repository.js';

@Injectable()
export class WorkflowService {
  constructor(@Inject(WorkflowRepository) private readonly repository: WorkflowRepository) {}

  async listTemplates() {
    return this.repository.listTemplates();
  }

  async getTemplate(id: string) {
    const template = await this.repository.findTemplateById(id);
    if (!template) {
      throw new NotFoundException(`Workflow template "${id}" not found`);
    }
    return template;
  }

  async createTemplate(dto: CreateWorkflowTemplateDto, creatorId?: string) {
    return this.repository.createTemplateWithInitialVersion(
      {
        name: dto.name,
        isDedicated: dto.isDedicated,
      },
      1,
      creatorId,
    );
  }

  async getVersion(id: string) {
    const version = await this.repository.findVersionById(id);
    if (!version) {
      throw new NotFoundException(`Workflow version "${id}" not found`);
    }
    return version;
  }

  async createNewVersion(templateId: string, creatorId?: string) {
    const latestVersion = await this.repository.findLatestVersionForTemplate(templateId);
    if (!latestVersion) {
      throw new NotFoundException(`No version found for template "${templateId}"`);
    }

    const nextVersionNo = latestVersion.versionNo + 1;
    return this.repository.createVersionCloningPrevious(
      templateId,
      nextVersionNo,
      latestVersion.id,
      creatorId,
    );
  }

  async addStep(versionId: string, dto: CreateStepDefinitionDto) {
    const version = await this.getVersion(versionId);
    if (version.status !== 'DRAFT') {
      throw new BusinessRuleViolation(
        'BR-02',
        `Cannot modify steps of a ${version.status} workflow version`,
      );
    }

    return this.repository.createStep({
      versionId,
      code: dto.code,
      name: dto.name,
      stepType: dto.stepType,
      seq: dto.seq,
      responsibleRole: dto.responsibleRole,
      stationType: dto.stationType ?? null,
      isMandatory: dto.isMandatory ?? true,
      requiresEvidence: dto.requiresEvidence ?? false,
      requiresQc: dto.requiresQc ?? false,
      conditionExpr: dto.conditionExpr ? JSON.parse(JSON.stringify(dto.conditionExpr)) : undefined,
      maxRework: dto.maxRework ?? null,
      isStart: dto.isStart ?? false,
      isEnd: dto.isEnd ?? false,
    });
  }

  async updateStep(stepId: string, dto: UpdateStepDefinitionDto) {
    const step = await this.repository.findStepById(stepId);
    if (!step) {
      throw new NotFoundException(`Step "${stepId}" not found`);
    }
    if (step.version.status !== 'DRAFT') {
      throw new BusinessRuleViolation(
        'BR-02',
        `Cannot modify steps of a ${step.version.status} workflow version`,
      );
    }

    return this.repository.updateStep(stepId, {
      ...(dto.code !== undefined && { code: dto.code }),
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.stepType !== undefined && { stepType: dto.stepType }),
      ...(dto.seq !== undefined && { seq: dto.seq }),
      ...(dto.responsibleRole !== undefined && { responsibleRole: dto.responsibleRole }),
      ...(dto.stationType !== undefined && { stationType: dto.stationType }),
      ...(dto.isMandatory !== undefined && { isMandatory: dto.isMandatory }),
      ...(dto.requiresEvidence !== undefined && { requiresEvidence: dto.requiresEvidence }),
      ...(dto.requiresQc !== undefined && { requiresQc: dto.requiresQc }),
      ...(dto.conditionExpr !== undefined && {
        conditionExpr: dto.conditionExpr ? JSON.parse(JSON.stringify(dto.conditionExpr)) : null,
      }),
      ...(dto.maxRework !== undefined && { maxRework: dto.maxRework }),
      ...(dto.isStart !== undefined && { isStart: dto.isStart }),
      ...(dto.isEnd !== undefined && { isEnd: dto.isEnd }),
    });
  }

  async deleteStep(stepId: string) {
    const step = await this.repository.findStepById(stepId);
    if (!step) {
      throw new NotFoundException(`Step "${stepId}" not found`);
    }
    if (step.version.status !== 'DRAFT') {
      throw new BusinessRuleViolation(
        'BR-02',
        `Cannot modify steps of a ${step.version.status} workflow version`,
      );
    }

    return this.repository.deleteStep(stepId);
  }

  async addTransition(versionId: string, dto: CreateStepTransitionDto) {
    const version = await this.getVersion(versionId);
    if (version.status !== 'DRAFT') {
      throw new BusinessRuleViolation(
        'BR-02',
        `Cannot modify transitions of a ${version.status} workflow version`,
      );
    }

    return this.repository.createTransition({
      versionId,
      fromStepId: dto.fromStepId,
      toStepId: dto.toStepId,
      kind: dto.kind ?? 'NORMAL',
      conditionExpr: dto.conditionExpr ? JSON.parse(JSON.stringify(dto.conditionExpr)) : undefined,
    });
  }

  async deleteTransition(transitionId: string) {
    const transition = await this.repository.findTransitionById(transitionId);
    if (!transition) {
      throw new NotFoundException(`Transition "${transitionId}" not found`);
    }
    if (transition.version.status !== 'DRAFT') {
      throw new BusinessRuleViolation(
        'BR-02',
        `Cannot modify transitions of a ${transition.version.status} workflow version`,
      );
    }

    return this.repository.deleteTransition(transitionId);
  }

  async validateVersion(
    versionOrId: string | NonNullable<Awaited<ReturnType<WorkflowRepository['findVersionById']>>>,
  ) {
    const version =
      typeof versionOrId === 'string' ? await this.getVersion(versionOrId) : versionOrId;

    const engineTemplate: WorkflowTemplateDefinition = {
      id: version.templateId,
      name: version.template?.name,
      steps: version.steps.map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        stepType: s.stepType,
        seq: s.seq,
        isStart: s.isStart,
        isEnd: s.isEnd,
        maxRework: s.maxRework,
      })),
      transitions: version.transitions.map((t) => ({
        id: t.id,
        fromStepId: t.fromStepId,
        toStepId: t.toStepId,
        kind: t.kind,
      })),
    };

    return validateTemplate(engineTemplate);
  }

  async publishVersion(versionId: string, actorId?: string) {
    const version = await this.getVersion(versionId);

    // Rule BR-02: Only DRAFT versions can be published
    if (version.status !== 'DRAFT') {
      throw new BusinessRuleViolation(
        'BR-02',
        `Only DRAFT versions can be published. Current version status is ${version.status}`,
      );
    }

    // Rule BR-01: Validate template graph
    const validationResult = await this.validateVersion(version);
    if (!validationResult.valid) {
      throw new BusinessRuleViolation(
        'BR-01',
        'Workflow template validation failed. Please resolve all violations before publishing.',
        { violations: validationResult.violations },
      );
    }

    return this.repository.publishVersionTransaction(versionId, version.templateId, actorId);
  }

  async assignTemplateToStyle(dto: AssignTemplateToStyleDto, actorId?: string) {
    const template = await this.getTemplate(dto.templateId);
    return this.repository.assignTemplateToStyle(dto.styleId, template.id, actorId);
  }
}
