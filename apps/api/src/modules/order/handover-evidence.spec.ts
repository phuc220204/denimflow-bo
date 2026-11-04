import { describe, it, expect, vi } from 'vitest';
import { HandoverService } from './handover.service.js';
import type { HandoverRepository } from './handover.repository.js';
import { EvidenceService } from '../execution/evidence.service.js';
import type { EvidenceStorage } from '../execution/evidence-storage.js';
import type { ExecutionRepository } from '../execution/execution.repository.js';
describe('Handover evidence gate', () => {
  it('BR-15 refuses handover when packing requires evidence but none exists', async () => {
    const repository = {
      transaction: vi.fn((work: (tx: unknown) => unknown) => work({})),
      lock: vi.fn(),
      lockSteps: vi.fn(),
      create: vi.fn(),
      findOrder: vi.fn().mockResolvedValue({
        id: 'order',
        status: 'IN_PRODUCTION',
        handoverRecord: null,
        qcProfile: { id: 'profile' },
        workflowInstance: {
          id: 'instance',
          status: 'RUNNING',
          requiresPlannerReview: false,
          stepInstances: [
            { id: 'qc', status: 'DONE', stepDefinition: { code: 'FINAL_QC' } },
            {
              id: 'pack',
              status: 'READY',
              stepDefinition: { code: 'PACK_HANDOVER', requiresEvidence: true },
            },
          ],
        },
      }),
    };
    const execution = { findEvidence: vi.fn().mockResolvedValue([]) };
    const evidence = new EvidenceService(
      execution as unknown as ExecutionRepository,
      {} as EvidenceStorage,
    );
    const service = new HandoverService(repository as unknown as HandoverRepository, evidence);
    await expect(service.create('order', {}, 'planner')).rejects.toThrow(/BR-15/);
    expect(repository.create).not.toHaveBeenCalled();
    expect(execution.findEvidence).toHaveBeenCalledWith('pack', {});
  });
});
