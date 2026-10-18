import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../../lib/api';
import { AuditPage } from './audit-page';

// Mock useAuth
vi.mock('../../lib/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'admin-1', role: 'ADMIN' },
    token: 'test-token',
  }),
}));

const mockAuditLogs: api.AuditLogItemDto[] = [
  {
    id: '101',
    entityType: 'production_order',
    entityId: 'ord-1111-1111-1111-111111111111',
    action: 'ORDER_CONFIRMED',
    oldValue: { status: 'DRAFT' },
    newValue: { status: 'CONFIRMED' },
    actorId: 'user-1',
    actorName: 'Trần Văn Kế Hoạch',
    actorEmail: 'planner@denimflow.internal',
    createdAt: '2026-10-18T10:00:00.000Z',
  },
  {
    id: '102',
    entityType: 'step_instance',
    entityId: 'step-2222-2222-2222-222222222222',
    action: 'STEP_TRANSITION',
    oldValue: null,
    newValue: { status: 'READY' },
    actorId: null,
    actorName: null,
    actorEmail: null,
    createdAt: '2026-10-18T10:05:00.000Z',
  },
];

describe('AuditPage (T5.6, FR-25, BR-16)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    vi.spyOn(api, 'fetchAuditLogsApi').mockResolvedValue({
      items: mockAuditLogs,
      total: 2,
      page: 1,
      limit: 15,
      totalPages: 1,
    });
  });

  it('renders audit logs with actions, actors, and entity details', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AuditPage />
      </QueryClientProvider>,
    );

    // Title
    expect(screen.getByText(/Nhật ký kiểm toán hệ thống/i)).toBeInTheDocument();

    // Actor details
    await waitFor(() => {
      expect(screen.getByText('Trần Văn Kế Hoạch')).toBeInTheDocument();
      expect(screen.getByText('planner@denimflow.internal')).toBeInTheDocument();
      expect(screen.getByText(/Hệ thống tự động/i)).toBeInTheDocument();
    });

    // Actions
    expect(screen.getByText('ORDER_CONFIRMED')).toBeInTheDocument();
    expect(screen.getByText('STEP_TRANSITION')).toBeInTheDocument();
  });

  it('opens changes modal when clicking "Xem thay đổi"', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AuditPage />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getAllByText('Xem thay đổi').length).toBe(2);
    });

    // Click "Xem thay đổi" for first log
    const buttons = screen.getAllByText('Xem thay đổi');
    expect(buttons[0]).toBeDefined();
    fireEvent.click(buttons[0]!);

    // Modal opens
    await waitFor(() => {
      expect(screen.getByText(/Chi tiết bản ghi kiểm toán #101/i)).toBeInTheDocument();
      expect(screen.getByText(/Dữ liệu trước thay đổi/i)).toBeInTheDocument();
      expect(screen.getByText(/Dữ liệu sau thay đổi/i)).toBeInTheDocument();
    });

    // Close modal
    fireEvent.click(screen.getByRole('button', { name: /Đóng/i }));

    await waitFor(() => {
      expect(screen.queryByText(/Chi tiết bản ghi kiểm toán #101/i)).not.toBeInTheDocument();
    });
  });

  it('allows filtering by entity type and resetting filters', async () => {
    const fetchSpy = vi.spyOn(api, 'fetchAuditLogsApi');

    render(
      <QueryClientProvider client={queryClient}>
        <AuditPage />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });

    // Select entity type
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'production_order' } });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ entityType: 'production_order' }),
        'test-token',
      );
    });

    // Reset filters
    fireEvent.click(screen.getByRole('button', { name: /Đặt lại bộ lọc/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ entityType: undefined }),
        'test-token',
      );
    });
  });
});
