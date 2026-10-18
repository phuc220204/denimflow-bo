import { describe, expect, it, vi } from 'vitest';
import { AuditRepository } from './audit.repository.js';
import { AuditService } from './audit.service.js';
import { AuditLogListResponseDto } from '@denimflow/shared';

describe('AuditService (T5.6, FR-25)', () => {
  it('delegates findAuditLogs to AuditRepository', async () => {
    const mockResponse: AuditLogListResponseDto = {
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 1,
    };

    const mockRepo = {
      findAuditLogs: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as AuditRepository;

    const service = new AuditService(mockRepo);
    const result = await service.findAuditLogs({ page: 1, limit: 20 });

    expect(result).toEqual(mockResponse);
    expect(mockRepo.findAuditLogs).toHaveBeenCalledWith({ page: 1, limit: 20 });
  });
});
