import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QualityRepository } from './quality.repository.js';
import { QualityService } from './quality.service.js';

describe('QualityService', () => {
  let service: QualityService;
  let repository: {
    evaluateInspection: ReturnType<typeof vi.fn>;
    recordInspection: ReturnType<typeof vi.fn>;
    getInspections: ReturnType<typeof vi.fn>;
    getReworkTargets: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    repository = {
      evaluateInspection: vi.fn(),
      recordInspection: vi.fn(),
      getInspections: vi.fn(),
      getReworkTargets: vi.fn(),
    };
    service = new QualityService(repository as unknown as QualityRepository);
  });

  it('delegates evaluateInspection to repository', async () => {
    const mockOutput = {
      passed: true,
      proposedResult: 'PASS' as const,
      shrinkagePassed: true,
      colorFadingPassed: true,
      defectRatePassed: true,
      totalDefectQty: 0,
      defectRatePercent: 0,
      reasons: [],
    };
    repository.evaluateInspection.mockResolvedValue(mockOutput);

    const res = await service.evaluateInspection('step-1', { sampleSize: 50 });
    expect(repository.evaluateInspection).toHaveBeenCalledWith('step-1', { sampleSize: 50 });
    expect(res).toEqual(mockOutput);
  });

  it('delegates recordInspection to repository', async () => {
    const mockRes = {
      id: 'insp-1',
      stepInstanceId: 'step-1',
      inspectorId: 'qc-1',
      sampleSize: 50,
      result: 'PASS' as const,
      createdAt: new Date().toISOString(),
      defects: [],
    };
    repository.recordInspection.mockResolvedValue(mockRes);

    const input = {
      stepInstanceId: 'step-1',
      sampleSize: 50,
      result: 'PASS' as const,
    };
    const res = await service.recordInspection(input, 'qc-1', 'QC_INSPECTOR');
    expect(repository.recordInspection).toHaveBeenCalledWith(input, 'qc-1', 'QC_INSPECTOR');
    expect(res).toEqual(mockRes);
  });

  it('delegates getInspections to repository', async () => {
    repository.getInspections.mockResolvedValue([]);
    const res = await service.getInspections('step-1');
    expect(repository.getInspections).toHaveBeenCalledWith('step-1');
    expect(res).toEqual([]);
  });

  it('delegates getReworkTargets to repository', async () => {
    repository.getReworkTargets.mockResolvedValue([]);
    const res = await service.getReworkTargets('step-1');
    expect(repository.getReworkTargets).toHaveBeenCalledWith('step-1');
    expect(res).toEqual([]);
  });
});
