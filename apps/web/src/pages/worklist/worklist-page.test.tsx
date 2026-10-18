import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Role } from '@denimflow/shared';
import * as api from '../../lib/api';
import { WorklistPage } from './worklist-page';

const mockOperator = {
  id: 'op-cutting-id',
  email: 'opcutting@denimflow.internal',
  fullName: 'Công Nhân Cắt Vải',
  role: Role.STATION_OPERATOR,
  isActive: true,
  token: 'operator-token',
};

vi.mock('../../lib/auth-context', () => ({
  useAuth: () => ({
    user: mockOperator,
    token: 'operator-token',
    isLoading: false,
    logout: vi.fn(),
  }),
}));

const mockWorklistItems: api.WorklistItemDto[] = [
  {
    id: 'step-cut-1',
    instanceId: 'inst-1',
    stepCode: 'CUTTING',
    stepName: 'Trải và Cắt vải',
    stepType: 'PRODUCTION',
    stationType: 'CUTTING',
    responsibleRole: 'STATION_OPERATOR',
    status: 'READY',
    orderId: 'order-1',
    orderNumber: 'PO-20261018-001',
    styleCode: 'JN-SLIM-01',
    styleName: 'Quần Jean Slim Fit',
    totalPlannedQty: 500,
    qtyIn: null,
    qtyGood: null,
    qtyDefect: null,
    startedAt: null,
    completedAt: null,
    performedBy: null,
    reworkCount: 0,
    requiresEvidence: false,
    requiresQc: false,
    isMandatory: true,
    seq: 60,
  },
  {
    id: 'step-sew-1',
    instanceId: 'inst-1',
    stepCode: 'SEWING',
    stepName: 'May ráp sản phẩm',
    stepType: 'PRODUCTION',
    stationType: 'SEWING',
    responsibleRole: 'STATION_OPERATOR',
    status: 'IN_PROGRESS',
    orderId: 'order-1',
    orderNumber: 'PO-20261018-001',
    styleCode: 'JN-SLIM-01',
    styleName: 'Quần Jean Slim Fit',
    totalPlannedQty: 500,
    qtyIn: 500,
    qtyGood: null,
    qtyDefect: null,
    startedAt: '2026-10-18T10:00:00.000Z',
    completedAt: null,
    performedBy: 'op-cutting-id',
    reworkCount: 0,
    requiresEvidence: false,
    requiresQc: true,
    isMandatory: true,
    seq: 80,
  },
];

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/worklist']}>
        <Routes>
          <Route path="/worklist" element={<WorklistPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('WorklistPage (T4.2, FR-12)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders worklist cards with step code, name, and order info', async () => {
    vi.spyOn(api, 'fetchWorklistApi').mockResolvedValue(mockWorklistItems);

    renderWithProviders();

    expect(screen.getByText('Danh sách công việc trạm')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('Trải và Cắt vải (CUTTING)')).toBeDefined();
      expect(screen.getByText('May ráp sản phẩm (SEWING)')).toBeDefined();
    });

    expect(screen.getAllByText('PO-20261018-001')).toHaveLength(2);
    expect(screen.getByText('Bắt đầu làm việc')).toBeDefined();
    expect(screen.getByText('Hoàn thành công đoạn')).toBeDefined();
  });

  it('triggers startStepApi when clicking Bắt đầu làm việc', async () => {
    vi.spyOn(api, 'fetchWorklistApi').mockResolvedValue(mockWorklistItems);
    const startSpy = vi.spyOn(api, 'startStepApi').mockResolvedValue({
      id: 'step-cut-1',
      status: 'IN_PROGRESS',
      startedAt: new Date().toISOString(),
      performedBy: mockOperator.id,
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Bắt đầu làm việc')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Bắt đầu làm việc'));

    await waitFor(() => {
      expect(startSpy).toHaveBeenCalledWith('step-cut-1', 'operator-token');
      expect(screen.getByText('Đã bắt đầu công đoạn thành công!')).toBeDefined();
    });
  });

  it('triggers completeStepApi when clicking Hoàn thành công đoạn', async () => {
    vi.spyOn(api, 'fetchWorklistApi').mockResolvedValue(mockWorklistItems);
    const completeSpy = vi.spyOn(api, 'completeStepApi').mockResolvedValue({
      id: 'step-sew-1',
      status: 'WAITING_QC',
      newlyReadyStepCodes: ['WASHING'],
      newlySkippedStepCodes: [],
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Hoàn thành công đoạn')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Hoàn thành công đoạn'));

    await waitFor(() => {
      expect(completeSpy).toHaveBeenCalledWith('step-sew-1', 'operator-token');
      expect(screen.getByText(/Đã xác nhận hoàn thành công đoạn!/)).toBeDefined();
    });
  });

  it('displays empty state card when worklist is empty', async () => {
    vi.spyOn(api, 'fetchWorklistApi').mockResolvedValue([]);

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Hiện không có công việc nào')).toBeDefined();
    });
  });
});
