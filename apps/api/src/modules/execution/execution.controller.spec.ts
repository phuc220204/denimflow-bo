import { describe, expect, it, vi } from 'vitest';
import { ExecutionController } from './execution.controller.js';
import type { ExecutionService } from './execution.service.js';

describe('ExecutionController', () => {
  const operator = {
    id: 'user-operator-1',
    email: 'operator@denimflow.test',
    fullName: 'Cutting Operator',
    role: 'STATION_OPERATOR',
    isActive: true,
  };

  const service = {
    getWorklist: vi.fn().mockResolvedValue([]),
    startStep: vi.fn().mockResolvedValue({ id: 's1', status: 'IN_PROGRESS' }),
    completeStep: vi.fn().mockResolvedValue({ id: 's1', status: 'DONE' }),
  };
  const controller = new ExecutionController(service as unknown as ExecutionService);

  it('passes the authenticated user and the parsed query to the worklist', async () => {
    await controller.getWorklist({ stationType: 'CUTTING' }, operator);
    expect(service.getWorklist).toHaveBeenCalledWith(operator, { stationType: 'CUTTING' });
  });

  it('rejects an unknown station type in the query', () => {
    expect(() => controller.getWorklist({ stationType: 'NOT_A_STATION' }, operator)).toThrow();
  });

  it('start and complete pass the step id and the authenticated user', async () => {
    await controller.startStep('s1', operator);
    await controller.completeStep('s1', operator);
    expect(service.startStep).toHaveBeenCalledWith('s1', operator);
    expect(service.completeStep).toHaveBeenCalledWith('s1', operator);
  });
});
