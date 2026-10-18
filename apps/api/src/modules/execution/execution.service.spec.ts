import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExecutionRepository } from './execution.repository.js';
import { ExecutionService } from './execution.service.js';

describe('ExecutionService', () => {
  let service: ExecutionService;
  let repository: {
    getWorklist: ReturnType<typeof vi.fn>;
    startStep: ReturnType<typeof vi.fn>;
    completeStep: ReturnType<typeof vi.fn>;
    recordQuantity: ReturnType<typeof vi.fn>;
    generateBundles: ReturnType<typeof vi.fn>;
    getBundles: ReturnType<typeof vi.fn>;
    getQuantityEntries: ReturnType<typeof vi.fn>;
    attachEvidence: ReturnType<typeof vi.fn>;
    getEvidence: ReturnType<typeof vi.fn>;
    approveQc: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    repository = {
      getWorklist: vi.fn(),
      startStep: vi.fn(),
      completeStep: vi.fn(),
      recordQuantity: vi.fn(),
      generateBundles: vi.fn(),
      getBundles: vi.fn(),
      getQuantityEntries: vi.fn(),
      attachEvidence: vi.fn(),
      getEvidence: vi.fn(),
      approveQc: vi.fn(),
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

  it('delegates recordQuantity to repository', async () => {
    const mockRes = {
      id: 'entry-1',
      stepInstanceId: 'step-1',
      bundleId: 'bundle-1',
      size: '30',
      qtyGood: 48,
      qtyDefect: 2,
      qtySent: null,
      qtyReceived: null,
      mismatchReason: null,
      note: 'Normal run',
      enteredBy: 'user-1',
      enteredAt: '2026-10-18T20:30:00.000Z',
    };
    repository.recordQuantity = vi.fn().mockResolvedValue(mockRes);
    const input = { bundleId: 'bundle-1', size: '30', qtyGood: 48, qtyDefect: 2 };
    const res = await service.recordQuantity('step-1', input, 'user-1', 'STATION_OPERATOR');
    expect(repository.recordQuantity).toHaveBeenCalledWith(
      'step-1',
      input,
      'user-1',
      'STATION_OPERATOR',
    );
    expect(res).toEqual(mockRes);
  });

  it('delegates generateBundles to repository', async () => {
    const mockRes = [
      {
        id: 'bundle-1',
        orderId: 'order-1',
        bundleCode: 'PO-001-B001',
        size: '30',
        qty: 50,
        currentStepInstanceId: 'step-1',
        createdAt: '2026-10-18T20:00:00.000Z',
        updatedAt: '2026-10-18T20:00:00.000Z',
      },
    ];
    repository.generateBundles = vi.fn().mockResolvedValue(mockRes);
    const res = await service.generateBundles('step-1', 'user-1');
    expect(repository.generateBundles).toHaveBeenCalledWith('step-1', 'user-1');
    expect(res).toEqual(mockRes);
  });

  it('delegates getBundles and getQuantityEntries to repository', async () => {
    repository.getBundles = vi.fn().mockResolvedValue([]);
    repository.getQuantityEntries = vi.fn().mockResolvedValue([]);
    await service.getBundles('step-1');
    await service.getQuantityEntries('step-1');
    expect(repository.getBundles).toHaveBeenCalledWith('step-1');
    expect(repository.getQuantityEntries).toHaveBeenCalledWith('step-1');
  });

  it('delegates attachEvidence and getEvidence to repository', async () => {
    const mockEvidence = {
      id: 'ev-1',
      stepInstanceId: 'step-1',
      filePath: 'orders/1/evidence.png',
      note: 'Evidence note',
      uploadedBy: 'user-1',
      uploadedAt: '2026-10-18T20:00:00.000Z',
    };
    repository.attachEvidence.mockResolvedValue(mockEvidence);
    repository.getEvidence.mockResolvedValue([mockEvidence]);

    const res = await service.attachEvidence(
      'step-1',
      { filePath: 'orders/1/evidence.png', note: 'Evidence note' },
      'user-1',
    );
    const list = await service.getEvidence('step-1');

    expect(repository.attachEvidence).toHaveBeenCalledWith(
      'step-1',
      { filePath: 'orders/1/evidence.png', note: 'Evidence note' },
      'user-1',
    );
    expect(res).toEqual(mockEvidence);
    expect(repository.getEvidence).toHaveBeenCalledWith('step-1');
    expect(list).toEqual([mockEvidence]);
  });

  it('delegates approveQc to repository', async () => {
    const mockRes = {
      id: 'step-1',
      status: 'DONE',
      completedAt: '2026-10-18T20:30:00.000Z',
      newlyReadyStepCodes: ['PACKING'],
      newlySkippedStepCodes: [],
    };
    repository.approveQc = vi.fn().mockResolvedValue(mockRes);
    const res = await service.approveQc('step-1', 'qc-1', 'QC_INSPECTOR', 'Passes');
    expect(repository.approveQc).toHaveBeenCalledWith('step-1', 'qc-1', 'QC_INSPECTOR', 'Passes');
    expect(res).toEqual(mockRes);
  });
});
