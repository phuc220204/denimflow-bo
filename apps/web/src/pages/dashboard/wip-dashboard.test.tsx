import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { mockDashboardWip } from '../../mocks/handlers';
import { server } from '../../mocks/server';
import { WipDashboardPage } from './wip-dashboard';

vi.mock('../../lib/auth-context', () => ({
  useAuth: () => ({ user: { id: 'manager-id', role: 'MANAGER' }, token: 'manager-token' }),
}));

// jsdom has no layout, so ResponsiveContainer would measure 0 x 0 and draw nothing.
vi.mock('recharts', async () => {
  const original = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...original,
    ResponsiveContainer: ({ children }: { children: React.ReactElement }) => (
      <div style={{ width: 800, height: 400 }}>
        {React.cloneElement(children as React.ReactElement<{ width: number; height: number }>, {
          width: 800,
          height: 400,
        })}
      </div>
    ),
  };
});

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <WipDashboardPage />
    </QueryClientProvider>,
  );
}

describe('WipDashboardPage (T5.5, FR-21)', () => {
  it('FR-21: shows the KPI tiles from the API totals', async () => {
    renderPage();

    const wipTile = (await screen.findByText('Bó đang sản xuất (WIP)')).parentElement!;
    expect(within(wipTile).getByText('4')).toBeInTheDocument();
    expect(within(wipTile).getByText('187 sản phẩm')).toBeInTheDocument();

    const ordersTile = screen.getByText('Đơn hàng').parentElement!;
    expect(within(ordersTile).getByText('8')).toBeInTheDocument();
    expect(within(ordersTile).getByText('3 đang chạy · 3 hoàn tất')).toBeInTheDocument();

    const defectTile = screen.getByText('Sản phẩm lỗi').parentElement!;
    expect(within(defectTile).getByText('14')).toBeInTheDocument();
    expect(within(defectTile).getByText('1 lần làm lại')).toBeInTheDocument();
  });

  it('FR-21: lists every order status with its count', async () => {
    renderPage();

    const card = (await screen.findByText('Đơn hàng theo trạng thái')).closest('div.rounded')!;
    const rows = within(card as HTMLElement).getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual([
      'Nháp2',
      'Đã xác nhận1',
      'Đang sản xuất2',
      'Tạm dừng0',
      'Hoàn tất3',
      'Đã huỷ0',
    ]);
  });

  it('R-26: shows WIP and totals per step, with no quantities for steps that do not record them', async () => {
    renderPage();

    const sewing = (await screen.findByText('Sewing')).closest('tr')!;
    expect(
      within(sewing)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['SewingSEWING', 'May', '1', '2', '98', '398', '392', '6', '1']);

    const stepTable = sewing.closest('table')!;
    const finalQc = within(stepTable).getByText('FINAL_QC').closest('tr')!;
    expect(
      within(finalQc)
        .getAllByRole('cell')
        .slice(2)
        .map((cell) => cell.textContent),
    ).toEqual(['1', '2', '89', '—', '—', '—', '0']);
  });

  it('R-26: draws one bar row per open step only', async () => {
    const { container } = renderPage();

    await screen.findByText('WIP theo công đoạn');
    await waitFor(() => {
      const ticks = [...container.querySelectorAll('.recharts-yAxis-tick-labels text')].map(
        (tick) => tick.textContent,
      );
      expect(ticks).toEqual(['SEWING', 'FINAL_QC']);
    });
  });

  it('R-26: lists the orders waiting for a QC decision', async () => {
    renderPage();

    const row = (await screen.findByText('PO-20261019-002')).closest('tr')!;
    expect(within(row).getByText('JN-SLIM-01')).toBeInTheDocument();
    expect(within(row).getByText('Sẵn sàng')).toBeInTheDocument();
  });

  it('shows the API error and a retry button', async () => {
    server.use(
      http.get('*/dashboard/wip', () =>
        HttpResponse.json(
          { message: 'Bạn không có quyền thực hiện thao tác này' },
          { status: 403 },
        ),
      ),
    );
    renderPage();

    expect(await screen.findByText('Không thể tải số liệu bảng điều khiển')).toBeInTheDocument();
    expect(screen.getByText('Bạn không có quyền thực hiện thao tác này')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
  });

  it('keeps the last numbers and warns when a refresh fails', async () => {
    renderPage();
    const wipTile = (await screen.findByText('Bó đang sản xuất (WIP)')).parentElement!;

    server.use(
      http.get('*/dashboard/wip', () => new HttpResponse('<html>502</html>', { status: 502 })),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Làm mới' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Không cập nhật được số liệu mới, đang hiển thị số liệu cũ.',
    );
    // A non-JSON error page still gives the Vietnamese message, not a JSON parse error.
    expect(screen.getByRole('alert')).toHaveTextContent('Không thể tải số liệu bảng điều khiển');
    expect(within(wipTile).getByText('4')).toBeInTheDocument();
  });

  it('renders an empty state without orders', async () => {
    server.use(
      http.get('*/dashboard/wip', () =>
        HttpResponse.json({
          ...mockDashboardWip,
          ordersByStatus: Object.fromEntries(
            Object.keys(mockDashboardWip.ordersByStatus).map((status) => [status, 0]),
          ),
          totals: { ...mockDashboardWip.totals, totalOrders: 0 },
          steps: [],
          waitingQc: [],
        }),
      ),
    );
    renderPage();

    expect(await screen.findByText('Chưa có đơn hàng nào.')).toBeInTheDocument();
    expect(screen.getByText('Chưa có đơn nào đang ở công đoạn sản xuất.')).toBeInTheDocument();
    expect(screen.getByText('Không có đơn nào đang chờ QC.')).toBeInTheDocument();
  });
});
