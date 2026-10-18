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

  it('T4.3: opens quantity modal and submits quantity entry successfully (FR-13, BR-08)', async () => {
    vi.spyOn(api, 'fetchWorklistApi').mockResolvedValue(mockWorklistItems);
    const recordQtySpy = vi.spyOn(api, 'recordQuantityApi').mockResolvedValue({
      id: 'entry-1',
      stepInstanceId: 'step-sew-1',
      bundleId: null,
      size: '30',
      qtyGood: 50,
      qtyDefect: 0,
      qtySent: null,
      qtyReceived: null,
      mismatchReason: null,
      note: null,
      enteredBy: mockOperator.id,
      enteredAt: new Date().toISOString(),
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Nhập sản lượng (FR-13)')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Nhập sản lượng (FR-13)'));

    expect(screen.getByText('Ghi nhận sản lượng (SEWING)')).toBeDefined();

    fireEvent.click(screen.getByText('Xác nhận ghi nhận'));

    await waitFor(() => {
      expect(recordQtySpy).toHaveBeenCalledWith(
        'step-sew-1',
        expect.objectContaining({ size: '30', qtyGood: 0 }),
        'operator-token',
      );
    });
  });

  it('T4.3: triggers bundle generation for cutting step (FR-15)', async () => {
    vi.spyOn(api, 'fetchWorklistApi').mockResolvedValue(mockWorklistItems);
    const bundleSpy = vi.spyOn(api, 'generateBundlesApi').mockResolvedValue([
      {
        id: 'b-1',
        orderId: 'order-1',
        bundleCode: 'PO-20261018-001-B001',
        size: '30',
        qty: 50,
        currentStepInstanceId: 'step-cut-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Tạo kiện hàng cắt (FR-15)')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Tạo kiện hàng cắt (FR-15)'));

    await waitFor(() => {
      expect(bundleSpy).toHaveBeenCalledWith('step-cut-1', 'operator-token');
      expect(screen.getByText(/Đã tạo thành công 1 kiện hàng/)).toBeDefined();
    });
  });

  it('T4.4: opens evidence modal and attaches evidence successfully (FR-14, BR-15)', async () => {
    const itemsWithEvidence: api.WorklistItemDto[] = [
      {
        ...mockWorklistItems[1]!,
        id: 'step-fin-1',
        stepCode: 'FINISHING',
        stepName: 'Hoàn thiện',
        requiresEvidence: true,
      },
    ];

    vi.spyOn(api, 'fetchWorklistApi').mockResolvedValue(itemsWithEvidence);
    const attachSpy = vi.spyOn(api, 'attachEvidenceApi').mockResolvedValue({
      id: 'ev-1',
      stepInstanceId: 'step-fin-1',
      filePath: 'orders/order-1/evidence/finishing-proof.jpg',
      note: 'Finish check',
      uploadedBy: mockOperator.id,
      uploadedAt: new Date().toISOString(),
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Đính kèm minh chứng (BR-15)')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Đính kèm minh chứng (BR-15)'));

    expect(screen.getByText('Đính kèm minh chứng (FINISHING)')).toBeDefined();

    fireEvent.click(screen.getByText('Lưu minh chứng'));

    await waitFor(() => {
      expect(attachSpy).toHaveBeenCalledWith(
        'step-fin-1',
        expect.objectContaining({
          filePath: 'orders/order-1/evidence/finishing-proof.jpg',
        }),
        'operator-token',
      );
    });
  });
});
