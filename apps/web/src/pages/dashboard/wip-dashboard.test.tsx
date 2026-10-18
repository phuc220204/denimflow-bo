import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../../lib/api';
import { WipDashboard } from './wip-dashboard';

// Mock useAuth
vi.mock('../../lib/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'user-1', role: 'MANAGER' },
    token: 'test-token',
  }),
}));

// Mock recharts ResponsiveContainer
vi.mock('recharts', async () => {
  const original = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...original,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 600, height: 300 }}>{children}</div>
    ),
  };
});

describe('WipDashboard Component (T5.5, FR-21)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  it('renders loading state initially', () => {
    vi.spyOn(api, 'fetchDashboardWipApi').mockReturnValue(new Promise(() => {}));

    render(
      <QueryClientProvider client={queryClient}>
        <WipDashboard />
      </QueryClientProvider>,
    );

    expect(screen.getByText(/Đang tải dữ liệu điều hành WIP phân xưởng/i)).toBeInTheDocument();
  });

  it('renders error state on fetch failure', async () => {
    vi.spyOn(api, 'fetchDashboardWipApi').mockRejectedValue(new Error('Lỗi máy chủ'));

    render(
      <QueryClientProvider client={queryClient}>
        <WipDashboard />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Không thể tải dữ liệu điều hành WIP/i)).toBeInTheDocument();
      expect(screen.getByText('Lỗi máy chủ')).toBeInTheDocument();
    });
  });

  it('renders WIP dashboard with totals, charts, tables and waiting QC alert', async () => {
    vi.spyOn(api, 'fetchDashboardWipApi').mockResolvedValue({
      ordersByStatus: {
        DRAFT: 2,
        CONFIRMED: 3,
        IN_PRODUCTION: 5,
        ON_HOLD: 0,
        COMPLETED: 8,
        CANCELLED: 1,
      },
      wipByStation: [
        {
          stationType: 'CUTTING',
          stepCode: 'CUTTING',
          stepName: 'Cắt vải',
          activeStepCount: 2,
          totalQtyIn: 200,
          totalQtyGood: 196,
          totalQtyDefect: 4,
          bundleCount: 4,
        },
        {
          stationType: 'SEWING',
          stepCode: 'SEWING',
          stepName: 'May ráp',
          activeStepCount: 3,
          totalQtyIn: 196,
          totalQtyGood: 188,
          totalQtyDefect: 8,
          bundleCount: 4,
        },
      ],
      totals: {
        totalOrders: 19,
        activeOrders: 8,
        completedOrders: 8,
        waitingQcCount: 1,
        totalQtyGood: 384,
        totalQtyDefect: 12,
        totalReworkCount: 2,
      },
      waitingQcOrders: [
        {
          orderId: '00000000-0000-0000-0000-000000000101',
          orderNumber: 'ORD-DEMO-001',
          styleCode: 'JN-SLIM-01',
          stepInstanceId: '00000000-0000-0000-0000-000000000201',
          stepCode: 'SEWING_QC',
          stepName: 'QC May ráp',
          stationType: 'QC',
          startedAt: '2026-10-18T10:00:00.000Z',
        },
      ],
    });

    render(
      <QueryClientProvider client={queryClient}>
        <WipDashboard />
      </QueryClientProvider>,
    );

    // Wait for title
    await waitFor(() => {
      expect(screen.getByText(/Bảng điều hành WIP & Sản lượng phân xưởng/i)).toBeInTheDocument();
    });

    // Totals assertions
    expect(screen.getByText('19')).toBeInTheDocument();
    expect(screen.getByText('384')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);

    // Waiting QC alert
    expect(screen.getByText(/Đơn hàng đang chờ kiểm tra chất lượng/i)).toBeInTheDocument();
    expect(screen.getByText('ORD-DEMO-001')).toBeInTheDocument();
    expect(screen.getByText('QC May ráp')).toBeInTheDocument();

    // Table rows
    expect(screen.getAllByText('CUTTING').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('SEWING').length).toBeGreaterThanOrEqual(1);
  });
});
