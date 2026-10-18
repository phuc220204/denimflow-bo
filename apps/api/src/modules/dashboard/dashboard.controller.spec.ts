import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../auth/auth.service.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';
import { DashboardWipSummaryDto } from '@denimflow/shared';

describe('DashboardController (T5.5, FR-21)', () => {
  it('calls authService.getMe and returns WIP summary', async () => {
    const mockSummary: DashboardWipSummaryDto = {
      ordersByStatus: {
        DRAFT: 0,
        CONFIRMED: 1,
        IN_PRODUCTION: 2,
        ON_HOLD: 0,
        COMPLETED: 3,
        CANCELLED: 0,
      },
      wipByStation: [],
      totals: {
        totalOrders: 6,
        activeOrders: 3,
        completedOrders: 3,
        waitingQcCount: 0,
        totalQtyGood: 300,
        totalQtyDefect: 5,
        totalReworkCount: 0,
      },
      waitingQcOrders: [],
    };

    const mockDashboardService = {
      getWipSummary: vi.fn().mockResolvedValue(mockSummary),
    } as unknown as DashboardService;

    const mockAuthService = {
      getMe: vi.fn().mockResolvedValue({ id: 'user-1', role: 'MANAGER' }),
    } as unknown as AuthService;

    const controller = new DashboardController(mockDashboardService, mockAuthService);
    const result = await controller.getWipSummary('Bearer token-123');

    expect(mockAuthService.getMe).toHaveBeenCalledWith('Bearer token-123');
    expect(mockDashboardService.getWipSummary).toHaveBeenCalledTimes(1);
    expect(result).toEqual(mockSummary);
  });
});
