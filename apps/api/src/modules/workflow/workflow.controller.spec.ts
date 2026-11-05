import { describe, expect, it, vi } from 'vitest';
import type { AuthResponse } from '../auth/auth.service.js';
import { WorkflowController } from './workflow.controller.js';
import type { WorkflowService } from './workflow.service.js';

const engineer: AuthResponse['user'] = {
  id: 'pe-uuid',
  email: 'pe@denimflow.test',
  fullName: 'PE',
  role: 'PROCESS_ENGINEER',
  isActive: true,
};

describe('WorkflowController', () => {
  const mockService = {
    listTemplates: vi.fn(),
    createTemplate: vi.fn(),
    getTemplate: vi.fn(),
    createNewVersion: vi.fn(),
    getVersion: vi.fn(),
    addStep: vi.fn(),
    updateStep: vi.fn(),
    deleteStep: vi.fn(),
    addTransition: vi.fn(),
    deleteTransition: vi.fn(),
    validateVersion: vi.fn(),
    publishVersion: vi.fn(),
    assignTemplateToStyle: vi.fn(),
  } as unknown as WorkflowService;

  const controller = new WorkflowController(mockService);

  it('listTemplates calls service.listTemplates', async () => {
    vi.mocked(mockService.listTemplates).mockResolvedValueOnce([]);
    const res = await controller.listTemplates();
    expect(res).toEqual([]);
    expect(mockService.listTemplates).toHaveBeenCalled();
  });

  it('BR-16: createTemplate validates schema and passes the creator to the service', async () => {
    vi.mocked(mockService.createTemplate).mockResolvedValueOnce({
      template: { id: 't1', name: 'New Template' },
      version: { id: 'v1', versionNo: 1 },
    } as unknown as Awaited<ReturnType<WorkflowService['createTemplate']>>);

    const res = await controller.createTemplate({ name: 'New Template' }, engineer);
    expect(res).toBeDefined();
    expect(mockService.createTemplate).toHaveBeenCalledWith(
      { name: 'New Template', isDedicated: false },
      'pe-uuid',
    );
  });

  it('createTemplate rejects invalid body', () => {
    expect(() => controller.createTemplate({ name: '' }, engineer)).toThrow();
  });

  it('addStep validates step DTO schema', async () => {
    vi.mocked(mockService.addStep).mockResolvedValueOnce({
      id: 's1',
    } as unknown as Awaited<ReturnType<WorkflowService['addStep']>>);

    await controller.addStep('v1', {
      code: 'CUTTING',
      name: 'Cutting operation',
      stepType: 'PRODUCTION',
      seq: 1,
      responsibleRole: 'STATION_OPERATOR',
    });

    expect(mockService.addStep).toHaveBeenCalledWith(
      'v1',
      expect.objectContaining({ code: 'CUTTING' }),
    );
  });

  it('BR-16: publishVersion passes the actor to the service', async () => {
    vi.mocked(mockService.publishVersion).mockResolvedValueOnce({
      id: 'v1',
      status: 'PUBLISHED',
    } as unknown as Awaited<ReturnType<WorkflowService['publishVersion']>>);

    const res = await controller.publishVersion('v1', engineer);
    expect(res.status).toBe('PUBLISHED');
    expect(mockService.publishVersion).toHaveBeenCalledWith('v1', 'pe-uuid');
  });

  it('BR-16: assignTemplateToStyle validates and passes the actor to the service', async () => {
    const styleId = '123e4567-e89b-12d3-a456-426614174000';
    const templateId = '123e4567-e89b-12d3-a456-426614174001';

    vi.mocked(mockService.assignTemplateToStyle).mockResolvedValueOnce({
      id: styleId,
      defaultTemplateId: templateId,
    } as unknown as Awaited<ReturnType<WorkflowService['assignTemplateToStyle']>>);

    const res = await controller.assignTemplateToStyle({ styleId, templateId }, engineer);

    expect(res).toBeDefined();
    expect(mockService.assignTemplateToStyle).toHaveBeenCalledWith(
      { styleId, templateId },
      'pe-uuid',
    );
  });
});
