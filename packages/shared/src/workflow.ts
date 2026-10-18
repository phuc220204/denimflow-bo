import { z } from 'zod';
import { nullableConditionAstSchema } from './conditions.js';
import { roleSchema, stationTypeSchema, stepTypeSchema, transitionKindSchema } from './enums.js';

export const createWorkflowTemplateSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(255),
    isDedicated: z.boolean().optional().default(false),
  })
  .strict();
export type CreateWorkflowTemplateDto = z.infer<typeof createWorkflowTemplateSchema>;

export const updateWorkflowTemplateSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();
export type UpdateWorkflowTemplateDto = z.infer<typeof updateWorkflowTemplateSchema>;

export const createStepDefinitionSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1, 'Code is required')
      .max(100)
      .regex(/^[A-Z0-9_]+$/, 'Code must be uppercase letters, numbers, and underscores'),
    name: z.string().trim().min(1, 'Name is required').max(255),
    stepType: stepTypeSchema,
    seq: z.number().int().min(1),
    responsibleRole: roleSchema,
    stationType: stationTypeSchema.nullable().optional(),
    isMandatory: z.boolean().optional().default(true),
    requiresEvidence: z.boolean().optional().default(false),
    requiresQc: z.boolean().optional().default(false),
    conditionExpr: nullableConditionAstSchema,
    maxRework: z.number().int().positive().nullable().optional(),
    isStart: z.boolean().optional().default(false),
    isEnd: z.boolean().optional().default(false),
  })
  .strict();
export type CreateStepDefinitionDto = z.infer<typeof createStepDefinitionSchema>;

export const updateStepDefinitionSchema = createStepDefinitionSchema.partial();
export type UpdateStepDefinitionDto = z.infer<typeof updateStepDefinitionSchema>;

export const createStepTransitionSchema = z
  .object({
    fromStepId: z.string().uuid(),
    toStepId: z.string().uuid(),
    kind: transitionKindSchema.optional().default('NORMAL'),
    conditionExpr: nullableConditionAstSchema,
  })
  .strict();
export type CreateStepTransitionDto = z.infer<typeof createStepTransitionSchema>;

export const assignTemplateToStyleSchema = z
  .object({
    styleId: z.string().uuid(),
    templateId: z.string().uuid(),
  })
  .strict();
export type AssignTemplateToStyleDto = z.infer<typeof assignTemplateToStyleSchema>;
