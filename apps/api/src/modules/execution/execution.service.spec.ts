import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExecutionRepository } from './execution.repository.js';
import { ExecutionService } from './execution.service.js';

describe('ExecutionService', () => {
  let service: ExecutionService;
  let repository: {
    getWorklist: ReturnType<typeof vi.fn>;
    startStep: ReturnType<typeof vi.fn>;
    completeStep: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    repository = {
      getWorklist: vi.fn(),
      startStep: vi.fn(),
      completeStep: vi.fn(),
    };
    service = new ExecutionService(repository as unknown as ExecutionRepository);
  });

  it('delegates getWorklist to repository', async () => {
    repository.getWorklist.mockResolvedValue([]);
    const res = await service.getWorklist('user-1', { stationType: 'CUTTING' });
    expect(repository.getWorklist).toHaveBeenCalledWith('user-1', {
      stationType: 'CUTTING',
    });
    expect(res).toEqual([]);
  });

  it('delegates startStep to repository', async () => {
    const mockRes = {
      id: 'step-1',
      status: 'IN_PROGRESS',
      startedAt: '2026-10-18T20:00:00.000Z',
      performedBy: 'user-1',
    };
    repository.startStep.mockResolvedValue(mockRes);
    const res = await service.startStep('step-1', 'user-1', 'STATION_OPERATOR');
    expect(repository.startStep).toHaveBeenCalledWith('step-1', 'user-1', 'STATION_OPERATOR');
    expect(res).toEqual(mockRes);
  });

  it('delegates completeStep to repository', async () => {
    const mockRes = {
      id: 'step-1',
      status: 'DONE',
      completedAt: '2026-10-18T20:30:00.000Z',
      newlyReadyStepCodes: ['SEWING'],
      newlySkippedStepCodes: [],
    };
    repository.completeStep.mockResolvedValue(mockRes);
    const res = await service.completeStep('step-1', 'user-1', 'STATION_OPERATOR');
    expect(repository.completeStep).toHaveBeenCalledWith('step-1', 'user-1', 'STATION_OPERATOR');
    expect(res).toEqual(mockRes);
  });
});
