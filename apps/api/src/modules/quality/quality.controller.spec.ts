import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../auth/auth.service.js';
import { QualityController } from './quality.controller.js';
import { QualityService } from './quality.service.js';

describe('QualityController', () => {
  let controller: QualityController;
  let qualityService: {
    evaluateInspection: ReturnType<typeof vi.fn>;
    recordInspection: ReturnType<typeof vi.fn>;
    getInspections: ReturnType<typeof vi.fn>;
  };
  let authService: {
    getMe: ReturnType<typeof vi.fn>;
  };

  const qcUser = {
    id: 'qc-user-1',
    email: 'qc@denimflow.test',
    fullName: 'QC Inspector',
    role: 'QC_INSPECTOR' as const,
    isActive: true,
  };

  beforeEach(() => {
    qualityService = {
      evaluateInspection: vi.fn(),
      recordInspection: vi.fn(),
      getInspections: vi.fn(),
    };
    authService = {
      getMe: vi.fn(),
    };
    controller = new QualityController(
      qualityService as unknown as QualityService,
      authService as unknown as AuthService,
    );
  });

  it('evaluateInspection validates input and delegates to qualityService', async () => {
    authService.getMe.mockResolvedValue(qcUser);
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
    qualityService.evaluateInspection.mockResolvedValue(mockOutput);

    const body = {
      sampleSize: 50,
      measuredShrinkagePercent: 2.5,
      measuredColorFadingLevel: 1,
    };
    const res = await controller.evaluateInspection('step-1', body, 'Bearer token');

    expect(authService.getMe).toHaveBeenCalledWith('Bearer token');
    expect(qualityService.evaluateInspection).toHaveBeenCalledWith(
      'step-1',
      expect.objectContaining({
        sampleSize: 50,
        measuredShrinkagePercent: 2.5,
        measuredColorFadingLevel: 1,
      }),
    );
    expect(res).toEqual(mockOutput);
  });

  it('recordInspection validates input and delegates to qualityService', async () => {
    authService.getMe.mockResolvedValue(qcUser);
    const mockRes = {
      id: 'insp-1',
      stepInstanceId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      inspectorId: qcUser.id,
      sampleSize: 50,
      result: 'PASS' as const,
      createdAt: new Date().toISOString(),
      defects: [],
    };
    qualityService.recordInspection.mockResolvedValue(mockRes);

    const body = {
      stepInstanceId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      sampleSize: 50,
      result: 'PASS' as const,
    };
    const res = await controller.recordInspection(body, 'Bearer token');

    expect(authService.getMe).toHaveBeenCalledWith('Bearer token');
    expect(qualityService.recordInspection).toHaveBeenCalledWith(
      expect.objectContaining(body),
      qcUser.id,
      qcUser.role,
    );
    expect(res).toEqual(mockRes);
  });

  it('getInspections delegates to qualityService', async () => {
    authService.getMe.mockResolvedValue(qcUser);
    qualityService.getInspections.mockResolvedValue([]);

    const res = await controller.getInspections('step-1', 'Bearer token');
    expect(authService.getMe).toHaveBeenCalledWith('Bearer token');
    expect(qualityService.getInspections).toHaveBeenCalledWith('step-1');
    expect(res).toEqual([]);
  });
});
