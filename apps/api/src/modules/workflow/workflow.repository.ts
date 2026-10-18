import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

@Injectable()
export class WorkflowRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listTemplates() {
    return this.prisma.workflowTemplate.findMany({
      include: {
        versions: {
          orderBy: { versionNo: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findTemplateById(id: string) {
    return this.prisma.workflowTemplate.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { versionNo: 'desc' },
          include: {
            steps: { orderBy: { seq: 'asc' } },
            transitions: true,
          },
        },
        styles: true,
      },
    });
  }

  async createTemplateWithInitialVersion(
    templateData: Prisma.WorkflowTemplateCreateInput,
    versionNo: number,
    createdBy?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const template = await tx.workflowTemplate.create({
        data: templateData,
      });

      const version = await tx.workflowVersion.create({
        data: {
          templateId: template.id,
          versionNo,
          status: 'DRAFT',
          createdBy,
        },
      });

      const updatedTemplate = await tx.workflowTemplate.update({
        where: { id: template.id },
        data: { currentVersionId: version.id },
        include: { versions: true },
      });

      return { template: updatedTemplate, version };
    });
  }

  async findVersionById(id: string) {
    return this.prisma.workflowVersion.findUnique({
      where: { id },
      include: {
        template: true,
        steps: { orderBy: { seq: 'asc' } },
        transitions: true,
      },
    });
  }

  async findLatestVersionForTemplate(templateId: string) {
    return this.prisma.workflowVersion.findFirst({
      where: { templateId },
      orderBy: { versionNo: 'desc' },
      include: {
        steps: { orderBy: { seq: 'asc' } },
        transitions: true,
      },
    });
  }

  async createVersionCloningPrevious(
    templateId: string,
    newVersionNo: number,
    previousVersionId: string,
    createdBy?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const prevVersion = await tx.workflowVersion.findUniqueOrThrow({
        where: { id: previousVersionId },
        include: {
          steps: true,
          transitions: true,
        },
      });

      const newVersion = await tx.workflowVersion.create({
        data: {
          templateId,
          versionNo: newVersionNo,
          status: 'DRAFT',
          createdBy,
        },
      });

      // Map old step IDs to new step IDs so transitions point correctly
      const stepIdMap = new Map<string, string>();

      for (const step of prevVersion.steps) {
        const createdStep = await tx.stepDefinition.create({
          data: {
            versionId: newVersion.id,
            code: step.code,
            name: step.name,
            stepType: step.stepType,
            seq: step.seq,
            responsibleRole: step.responsibleRole,
            stationType: step.stationType,
            isMandatory: step.isMandatory,
            requiresEvidence: step.requiresEvidence,
            requiresQc: step.requiresQc,
            conditionExpr: step.conditionExpr ?? undefined,
            maxRework: step.maxRework,
            isStart: step.isStart,
            isEnd: step.isEnd,
          },
        });
        stepIdMap.set(step.id, createdStep.id);
      }

      for (const t of prevVersion.transitions) {
        const newFrom = stepIdMap.get(t.fromStepId);
        const newTo = stepIdMap.get(t.toStepId);
        if (newFrom && newTo) {
          await tx.stepTransition.create({
            data: {
              versionId: newVersion.id,
              fromStepId: newFrom,
              toStepId: newTo,
              kind: t.kind,
              conditionExpr: t.conditionExpr ?? undefined,
            },
          });
        }
      }

      return tx.workflowVersion.findUniqueOrThrow({
        where: { id: newVersion.id },
        include: {
          steps: { orderBy: { seq: 'asc' } },
          transitions: true,
        },
      });
    });
  }

  async createStep(data: Prisma.StepDefinitionUncheckedCreateInput) {
    return this.prisma.stepDefinition.create({
      data,
    });
  }

  async findStepById(id: string) {
    return this.prisma.stepDefinition.findUnique({
      where: { id },
      include: { version: true },
    });
  }

  async updateStep(id: string, data: Prisma.StepDefinitionUpdateInput) {
    return this.prisma.stepDefinition.update({
      where: { id },
      data,
    });
  }

  async deleteStep(id: string) {
    return this.prisma.stepDefinition.delete({
      where: { id },
    });
  }

  async createTransition(data: Prisma.StepTransitionUncheckedCreateInput) {
    return this.prisma.stepTransition.create({
      data,
    });
  }

  async findTransitionById(id: string) {
    return this.prisma.stepTransition.findUnique({
      where: { id },
      include: { version: true },
    });
  }

  async deleteTransition(id: string) {
    return this.prisma.stepTransition.delete({
      where: { id },
    });
  }

  async publishVersionTransaction(versionId: string, templateId: string, actorId?: string) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Retire previous published version for this template (if any)
      await tx.workflowVersion.updateMany({
        where: {
          templateId,
          status: 'PUBLISHED',
          id: { not: versionId },
        },
        data: {
          status: 'RETIRED',
        },
      });

      // 2. Mark this version as PUBLISHED
      const publishedVersion = await tx.workflowVersion.update({
        where: { id: versionId },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
        include: {
          steps: { orderBy: { seq: 'asc' } },
          transitions: true,
        },
      });

      // 3. Update currentVersionId on template
      await tx.workflowTemplate.update({
        where: { id: templateId },
        data: { currentVersionId: versionId },
      });

      // 4. Record AuditLog (BR-16)
      await tx.auditLog.create({
        data: {
          entityType: 'WorkflowVersion',
          entityId: versionId,
          action: 'PUBLISH_VERSION',
          actorId,
          newValue: {
            templateId,
            versionNo: publishedVersion.versionNo,
            status: 'PUBLISHED',
            publishedAt: publishedVersion.publishedAt,
          },
        },
      });

      return publishedVersion;
    });
  }

  async assignTemplateToStyle(styleId: string, templateId: string, actorId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const style = await tx.style.update({
        where: { id: styleId },
        data: { defaultTemplateId: templateId },
      });

      await tx.auditLog.create({
        data: {
          entityType: 'Style',
          entityId: styleId,
          action: 'ASSIGN_WORKFLOW_TEMPLATE',
          actorId,
          newValue: {
            defaultTemplateId: templateId,
          },
        },
      });

      return style;
    });
  }
}
