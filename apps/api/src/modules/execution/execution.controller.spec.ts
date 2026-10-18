import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../auth/auth.service.js';
import { ExecutionController } from './execution.controller.js';
import { ExecutionService } from './execution.service.js';

describe('ExecutionController', () => {
  let controller: ExecutionController;
  let executionService: {
    getWorklist: ReturnType<typeof vi.fn>;
    startStep: ReturnType<typeof vi.fn>;
    completeStep: ReturnType<typeof vi.fn>;
    recordQuantity: ReturnType<typeof vi.fn>;
    generateBundles: ReturnType<typeof vi.fn>;
    getBundles: ReturnType<typeof vi.fn>;
    getQuantityEntries: ReturnType<typeof vi.fn>;
  };
  let authService: {
    getMe: ReturnType<typeof vi.fn>;
  };

  const operatorUser = {
    id: 'user-operator-1',
    email: 'operator@denimflow.test',
    fullName: 'Cutting Operator',
    role: 'STATION_OPERATOR',
    isActive: true,
  };

  beforeEach(() => {
    executionService = {
      getWorklist: vi.fn(),
      startStep: vi.fn(),
      completeStep: vi.fn(),
      recordQuantity: vi.fn(),
      generateBundles: vi.fn(),
      getBundles: vi.fn(),
      getQuantityEntries: vi.fn(),
    };
    authService = {
      getMe: vi.fn(),
    };

    controller = new ExecutionController(
      executionService as unknown as ExecutionService,
      authService as unknown as AuthService,
    );
  });

  it('getWorklist calls executionService with user id and parsed query', async () => {
    authService.getMe.mockResolvedValue(operatorUser);
    executionService.getWorklist.mockResolvedValue([]);

    const result = await controller.getWorklist({ stationType: 'CUTTING' }, 'Bearer token');

    expect(authService.getMe).toHaveBeenCalledWith('Bearer token');
    expect(executionService.getWorklist).toHaveBeenCalledWith(operatorUser.id, {
      stationType: 'CUTTING',
    });
    expect(result).toEqual([]);
  });

  it('startStep calls executionService.startStep with step id, actorId, and actorRole', async () => {
    authService.getMe.mockResolvedValue(operatorUser);
    const mockResponse = {
      id: 'step-1',
      status: 'IN_PROGRESS',
      startedAt: new Date().toISOString(),
      performedBy: operatorUser.id,
    };
    executionService.startStep.mockResolvedValue(mockResponse);

    const result = await controller.startStep('step-1', 'Bearer token');

    expect(executionService.startStep).toHaveBeenCalledWith(
      'step-1',
      operatorUser.id,
      operatorUser.role,
    );
    expect(result).toEqual(mockResponse);
  });

  it('completeStep calls executionService.completeStep with step id, actorId, and actorRole', async () => {
    authService.getMe.mockResolvedValue(operatorUser);
    const mockResponse = {
      id: 'step-1',
      status: 'DONE',
      completedAt: new Date().toISOString(),
      newlyReadyStepCodes: ['SEWING'],
      newlySkippedStepCodes: [],
    };
    executionService.completeStep.mockResolvedValue(mockResponse);

    const result = await controller.completeStep('step-1', 'Bearer token');

    expect(executionService.completeStep).toHaveBeenCalledWith(
      'step-1',
      operatorUser.id,
      operatorUser.role,
    );
    expect(result).toEqual(mockResponse);
  });

  it('recordQuantity calls executionService.recordQuantity with valid input', async () => {
    authService.getMe.mockResolvedValue(operatorUser);
    const mockEntry = {
      id: 'entry-1',
      stepInstanceId: 'step-1',
      bundleId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      size: '30',
      qtyGood: 50,
      qtyDefect: 0,
      enteredBy: operatorUser.id,
      enteredAt: new Date().toISOString(),
    };
    executionService.recordQuantity.mockResolvedValue(mockEntry);

    const body = {
      bundleId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      size: '30',
      qtyGood: 50,
      qtyDefect: 0,
    };
    const result = await controller.recordQuantity('step-1', body, 'Bearer token');

    expect(authService.getMe).toHaveBeenCalledWith('Bearer token');
    expect(executionService.recordQuantity).toHaveBeenCalledWith(
      'step-1',
      body,
      operatorUser.id,
      operatorUser.role,
    );
    expect(result).toEqual(mockEntry);
  });

  it('generateBundles and getBundles call executionService', async () => {
    authService.getMe.mockResolvedValue(operatorUser);
    executionService.generateBundles.mockResolvedValue([]);
    executionService.getBundles.mockResolvedValue([]);
    executionService.getQuantityEntries.mockResolvedValue([]);

    await controller.generateBundles('step-1', 'Bearer token');
    await controller.getBundles('step-1', 'Bearer token');
    await controller.getQuantities('step-1', 'Bearer token');

    expect(executionService.generateBundles).toHaveBeenCalledWith('step-1', operatorUser.id);
    expect(executionService.getBundles).toHaveBeenCalledWith('step-1');
    expect(executionService.getQuantityEntries).toHaveBeenCalledWith('step-1');
  });
});
