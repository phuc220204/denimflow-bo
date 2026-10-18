import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../lib/api';
import { HomePage } from './home';

// Mock useAuth hook to return logged in admin
vi.mock('../lib/auth-context', async () => {
  const actual = await vi.importActual<typeof import('../lib/auth-context')>('../lib/auth-context');
  return {
    ...actual,
    useAuth: () => ({
      user: {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'admin@denimflow.local',
        fullName: 'Trần Văn Quản Trị',
        role: 'ADMIN',
        isActive: true,
      },
      token: 'mock-token',
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    }),
  };
});

// Mock recharts ResponsiveContainer for JSDOM
vi.mock('recharts', async () => {
  const original = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...original,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div className="recharts-responsive-container-mock" style={{ width: 800, height: 400 }}>
        {children}
      </div>
    ),
  };
});

describe('HomePage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

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
  });

  it('renders user account details and system health telemetry', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <HomePage />
        </BrowserRouter>
      </QueryClientProvider>,
    );

    // Assert role-specific workspace header displayed
    expect(screen.getByText(/Bàn làm việc Quản trị viên hệ thống/i)).toBeInTheDocument();
    expect(screen.getAllByText('admin@denimflow.local').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Quản trị viên').length).toBeGreaterThan(0);

    // Assert telemetry loaded from MSW
    await waitFor(() => {
      expect(screen.getByText(/Đang hoạt động tốt/i)).toBeInTheDocument();
      expect(screen.getByText(/Đã đồng bộ an toàn/i)).toBeInTheDocument();
    });
  });

  it('renders WIP dashboard with KPI metrics, waiting QC orders and WIP station breakdown (T5.5, FR-21)', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <HomePage />
        </BrowserRouter>
      </QueryClientProvider>,
    );

    // Assert dashboard title after data loads
    await waitFor(() => {
      expect(screen.getByText(/Bảng điều hành WIP & Sản lượng phân xưởng/i)).toBeInTheDocument();
    });

    // Assert KPI metrics rendered
    await waitFor(() => {
      expect(screen.getByText('19')).toBeInTheDocument(); // totalOrders
      expect(screen.getByText('384')).toBeInTheDocument(); // totalQtyGood
      expect(screen.getByText('12')).toBeInTheDocument(); // totalQtyDefect
      expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1); // totalReworkCount
    });

    // Assert waiting QC alerts
    expect(screen.getByText('ORD-DEMO-001')).toBeInTheDocument();
    expect(screen.getByText(/Đơn hàng đang chờ kiểm tra chất lượng/i)).toBeInTheDocument();

    // Assert WIP table rows
    expect(screen.getAllByText('CUTTING').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('SEWING').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Cắt vải')).toBeInTheDocument();
    expect(screen.getByText('May ráp')).toBeInTheDocument();
  });
});
