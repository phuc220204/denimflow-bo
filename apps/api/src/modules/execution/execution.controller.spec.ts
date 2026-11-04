import { describe, expect, it, vi } from 'vitest';
import { ExecutionController } from './execution.controller.js';
import type { ExecutionService } from './execution.service.js';
import type { QuantityService } from './quantity.service.js';

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
  const quantities = {
    getQuantityPanel: vi.fn().mockResolvedValue({}),
    recordQuantity: vi.fn().mockResolvedValue({ id: 'e1' }),
    reverseEntry: vi.fn().mockResolvedValue({ id: 'e2' }),
  };
  const controller = new ExecutionController(
    service as unknown as ExecutionService,
    quantities as unknown as QuantityService,
  );

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

  it('parses the quantity body before calling the service', async () => {
    await controller.recordQuantity('s1', { size: '30', qtyGood: 10 }, operator);
    expect(quantities.recordQuantity).toHaveBeenCalledWith(
      's1',
      { size: '30', qtyGood: 10, qtyDefect: 0 },
      operator,
    );
    expect(() => controller.recordQuantity('s1', { qtyGood: 10 }, operator)).toThrow();
    expect(() =>
      controller.recordQuantity('s1', { size: '30', qtyGood: 1, unknown: true }, operator),
    ).toThrow();
  });

  it('requires a reason to reverse an entry', async () => {
    expect(() => controller.reverseQuantity('s1', 'e1', { reason: ' ' }, operator)).toThrow();
    await controller.reverseQuantity('s1', 'e1', { reason: 'Gõ nhầm' }, operator);
    expect(quantities.reverseEntry).toHaveBeenCalledWith(
      's1',
      'e1',
      { reason: 'Gõ nhầm' },
      operator,
    );
  });
});
