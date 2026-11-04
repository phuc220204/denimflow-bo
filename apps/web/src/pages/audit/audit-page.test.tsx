import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import * as api from '../../lib/api';
import { AuditPage, diffAuditValues, entityTypeLabel } from './audit-page';

vi.mock('../../lib/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'admin-1', role: 'ADMIN' },
    token: 'test-token',
  }),
}));

const ORDER_ID = '11111111-1111-4111-8111-111111111111';
const PLANNER_ID = '00000000-0000-0000-0000-000000000003';

const logs: api.AuditLogItemDto[] = [
  {
    id: '101',
    entityType: 'ProductionOrder',
    entityId: ORDER_ID,
    action: 'CONFIRM_ORDER',
    oldValue: { status: 'DRAFT', dueDate: '2026-12-31' },
    newValue: { status: 'CONFIRMED', dueDate: '2026-12-31' },
    actorId: PLANNER_ID,
    actorName: 'Điều Độ Kế Hoạch Sản Xuất',
    actorEmail: 'planner@denimflow.internal',
    createdAt: '2026-10-18T10:00:00.000Z',
  },
  {
    id: '102',
    entityType: 'StepInstance',
    entityId: '22222222-2222-4222-8222-222222222222',
    action: 'SYSTEM_EVENT',
    oldValue: null,
    newValue: { status: 'READY' },
    actorId: null,
    actorName: null,
    actorEmail: null,
    createdAt: '2026-10-18T10:05:00.000Z',
  },
];

const renderPage = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <AuditPage />
    </QueryClientProvider>,
  );

type FetchLogsSpy = MockInstance<typeof api.fetchAuditLogsApi>;
const lastQuery = (spy: FetchLogsSpy) => spy.mock.calls.at(-1)?.[0];

describe('AuditPage (T5.6, FR-25)', () => {
  let fetchLogs: FetchLogsSpy;

  beforeEach(() => {
    fetchLogs = vi
      .spyOn(api, 'fetchAuditLogsApi')
      .mockResolvedValue({ items: logs, total: 2, page: 1, limit: 20, totalPages: 1 });
    vi.spyOn(api, 'fetchAuditFilterOptionsApi').mockResolvedValue({
      entityTypes: ['ProductionOrder', 'StepInstance'],
      actors: [
        {
          id: PLANNER_ID,
          fullName: 'Điều Độ Kế Hoạch Sản Xuất',
          email: 'planner@denimflow.internal',
        },
      ],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('FR-25: lists who did what to which entity, with system rows labelled', async () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Nhật ký kiểm toán' })).toBeInTheDocument();
    const table = within(await screen.findByRole('table'));
    expect(await table.findByText('Điều Độ Kế Hoạch Sản Xuất')).toBeInTheDocument();
    expect(table.getByText('planner@denimflow.internal')).toBeInTheDocument();
    expect(table.getByText('Hệ thống')).toBeInTheDocument();
    expect(table.getByText('CONFIRM_ORDER')).toBeInTheDocument();
    expect(table.getByText('Đơn hàng')).toBeInTheDocument();
    expect(table.getByText('Công đoạn')).toBeInTheDocument();
    expect(fetchLogs).toHaveBeenCalledWith({ page: 1, limit: 20 }, 'test-token');
  });

  it('FR-25: shows the field changes in a dialog and closes it', async () => {
    renderPage();

    fireEvent.click((await screen.findAllByRole('button', { name: /Xem thay đổi/ }))[0]!);

    const dialog = within(screen.getByRole('dialog', { name: /Chi tiết bản ghi #101/ }));
    // Only `status` changed; `dueDate` is listed without the badge.
    expect(dialog.getAllByText('Đã đổi')).toHaveLength(1);
    expect(dialog.getByText('DRAFT')).toBeInTheDocument();
    expect(dialog.getByText('CONFIRMED')).toBeInTheDocument();
    expect(dialog.getByText('dueDate')).toBeInTheDocument();

    fireEvent.click(dialog.getAllByRole('button', { name: 'Đóng' })[0]!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: /Xem thay đổi/ })[1]!);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('FR-25: filters by entity type, actor and entity id, and resets the filters', async () => {
    renderPage();
    await screen.findByRole('option', { name: /Đơn hàng \(ProductionOrder\)/ });

    fireEvent.change(screen.getByLabelText('Loại đối tượng'), {
      target: { value: 'ProductionOrder' },
    });
    fireEvent.change(screen.getByLabelText('Người thao tác'), { target: { value: PLANNER_ID } });
    fireEvent.change(screen.getByLabelText('Mã đối tượng (UUID)'), {
      target: { value: ` ${ORDER_ID} ` },
    });

    await waitFor(() =>
      expect(lastQuery(fetchLogs)).toEqual({
        entityType: 'ProductionOrder',
        actorId: PLANNER_ID,
        entityId: ORDER_ID,
        page: 1,
        limit: 20,
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại bộ lọc' }));
    await waitFor(() => expect(lastQuery(fetchLogs)).toEqual({ page: 1, limit: 20 }));
  });

  it('FR-25: does not send an entity id that is not a UUID', async () => {
    renderPage();
    await screen.findByRole('table');

    fireEvent.change(screen.getByLabelText('Mã đối tượng (UUID)'), { target: { value: 'PO-1' } });

    expect(await screen.findByText('Mã chưa đúng định dạng UUID')).toBeInTheDocument();
    expect(fetchLogs.mock.calls.every(([query]) => query.entityId === undefined)).toBe(true);
  });

  it('FR-25: sends the picked days as an inclusive local-day range', async () => {
    renderPage();
    await screen.findByRole('table');

    fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2026-10-18' } });
    fireEvent.change(screen.getByLabelText('Đến ngày'), { target: { value: '2026-10-19' } });

    await waitFor(() =>
      expect(lastQuery(fetchLogs)).toMatchObject({
        from: new Date('2026-10-18T00:00:00').toISOString(),
        to: new Date('2026-10-19T23:59:59.999').toISOString(),
      }),
    );
  });

  it('FR-25: blocks a reversed date range instead of calling the API', async () => {
    renderPage();
    await screen.findByRole('table');
    const callsBefore = fetchLogs.mock.calls.length;

    fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2026-10-20' } });
    fireEvent.change(screen.getByLabelText('Đến ngày'), { target: { value: '2026-10-19' } });

    expect(
      await screen.findByText('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc'),
    ).toBeInTheDocument();
    // Only the "from" change may have been fetched; the reversed range never is.
    expect(fetchLogs.mock.calls.slice(callsBefore).every(([query]) => !query.to)).toBe(true);
  });

  it('FR-25: moves to the next page', async () => {
    fetchLogs.mockResolvedValue({ items: logs, total: 25, page: 1, limit: 20, totalPages: 2 });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Trang sau' }));

    await waitFor(() => expect(lastQuery(fetchLogs)).toMatchObject({ page: 2 }));
  });

  it('FR-25: shows the API error', async () => {
    fetchLogs.mockRejectedValue(new Error('Bạn không có quyền thực hiện thao tác này'));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Bạn không có quyền thực hiện thao tác này',
    );
  });
});

describe('audit helpers', () => {
  it('labels entity types written in any naming style', () => {
    expect(entityTypeLabel('ProductionOrder')).toBe('Đơn hàng');
    expect(entityTypeLabel('production_order')).toBe('Đơn hàng');
    expect(entityTypeLabel('FABRIC_TYPE')).toBe('Loại vải');
    expect(entityTypeLabel('SomethingNew')).toBe('SomethingNew');
  });

  it('diffs object values field by field and falls back to raw JSON otherwise', () => {
    expect(diffAuditValues(null, { status: 'READY' })).toEqual([
      { key: 'status', before: undefined, after: 'READY', changed: true },
    ]);
    expect(diffAuditValues(null, null)).toEqual([]);
    expect(diffAuditValues([1], [2])).toBeNull();
  });
});
