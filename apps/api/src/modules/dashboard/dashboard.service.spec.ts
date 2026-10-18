import { describe, expect, it, vi } from 'vitest';
import { DashboardRepository } from './dashboard.repository.js';
import { DashboardService } from './dashboard.service.js';
import { DashboardWipSummaryDto } from '@denimflow/shared';

describe('DashboardService (T5.5, FR-21)', () => {
  it('delegates getWipSummary to DashboardRepository', async () => {
    const mockSummary: DashboardWipSummaryDto = {
      ordersByStatus: {
        DRAFT: 1,
        CONFIRMED: 2,
        IN_PRODUCTION: 3,
        ON_HOLD: 0,
        COMPLETED: 4,
        CANCELLED: 0,
      },
      wipByStation: [],
      totals: {
        totalOrders: 10,
        activeOrders: 5,
        completedOrders: 4,
        waitingQcCount: 0,
        totalQtyGood: 500,
        totalQtyDefect: 10,
        totalReworkCount: 1,
      },
      waitingQcOrders: [],
    };

    const mockRepo = {
      getWipSummary: vi.fn().mockResolvedValue(mockSummary),
    } as unknown as DashboardRepository;

    const service = new DashboardService(mockRepo);
    const result = await service.getWipSummary();

    expect(result).toEqual(mockSummary);
    expect(mockRepo.getWipSummary).toHaveBeenCalledTimes(1);
  });
});
