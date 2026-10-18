import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Role } from '@denimflow/shared';
import * as api from '../../lib/api';
import { OrdersPage } from './orders-page';

const mockUser: {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  token?: string;
} = {
  id: 'planner-uuid',
  email: 'planner@denimflow.internal',
  fullName: 'Điều Độ Sản Xuất',
  role: Role.PRODUCTION_PLANNER,
  isActive: true,
  token: 'planner-token',
};

vi.mock('../../lib/auth-context', () => ({
  useAuth: () => ({
    user: mockUser,
    token: 'planner-token',
    isLoading: false,
    logout: vi.fn(),
  }),
}));

const mockStyles = [
  {
    id: 'style-1',
    styleCode: 'JN-SLIM-01',
    name: 'Quần Jean Slim Fit',
    fitType: 'SLIM',
    hasEmbroidery: false,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const mockOrders: api.ProductionOrderItem[] = [
  {
    id: 'order-1',
    orderNumber: 'PO-2026-0001',
    styleId: 'style-1',
    status: 'DRAFT',
    dueDate: '2026-11-20',
    customerRef: 'CUST-ALPHA',
    notes: 'Order test notes',
    dyeRequired: false,
    embroideryRequired: false,
    fabricInspectRequired: false,
    ppSampleRequired: false,
    skipCleanWash: false,
    isCustom: false,
    fabricTypeId: 'fab-1',
    colorId: 'col-1',
    fabricType: {
      id: 'fab-1',
      code: 'DENIM-12OZ',
      name: 'Vải Denim 12oz',
      stretchType: 'RIGID',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    color: {
      id: 'col-1',
      code: 'INDIGO-DARK',
      name: 'Xanh Chàm Đậm',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    createdBy: 'planner-uuid',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    style: mockStyles[0],
    sizeLines: [
      { id: 'sl-1', size: '29', plannedQty: 100 },
      { id: 'sl-2', size: '30', plannedQty: 150 },
    ],
  },
];

const mockFabrics = [
  {
    id: 'fab-1',
    code: 'DENIM-12OZ',
    name: 'Vải Denim 12oz',
    stretchType: 'RIGID',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const mockAllowedColors = [
  {
    id: 'col-1',
    code: 'INDIGO-DARK',
    name: 'Xanh Chàm Đậm',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const mockBomLines: api.BomLineItem[] = [
  {
    id: 'bom-1',
    orderId: 'order-1',
    materialType: 'FABRIC',
    requiredQty: 382.5,
    unit: 'METER',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'bom-2',
    orderId: 'order-1',
    materialType: 'BUTTON',
    requiredQty: 250,
    unit: 'PIECE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/orders']}>
        <Routes>
          <Route path="/orders" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('OrdersPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'fetchOrdersApi').mockResolvedValue(mockOrders);
    vi.spyOn(api, 'fetchStyles').mockResolvedValue(mockStyles);
    vi.spyOn(api, 'fetchWashTypes').mockResolvedValue([]);
    vi.spyOn(api, 'fetchFabricTypes').mockResolvedValue(mockFabrics);
    vi.spyOn(api, 'fetchAllowedColors').mockResolvedValue(mockAllowedColors);
    vi.spyOn(api, 'selectFabricColorApi').mockResolvedValue(mockOrders[0]!);
    vi.spyOn(api, 'fetchBomLinesApi').mockResolvedValue(mockBomLines);
    vi.spyOn(api, 'calculateBomApi').mockResolvedValue(mockBomLines);
  });

  it('renders orders list with order number and style', async () => {
    renderWithClient(<OrdersPage />);

    expect(await screen.findByText('PO-2026-0001')).toBeInTheDocument();
    expect(screen.getByText('Quần Jean Slim Fit')).toBeInTheDocument();
    expect(screen.getByText(/Ref: CUST-ALPHA/)).toBeInTheDocument();
    expect(screen.getByText(/∑ 250/)).toBeInTheDocument();
  });

  it('opens modal to create order and enforces BR-17 custom flag logic', async () => {
    renderWithClient(<OrdersPage />);

    const createBtn = await screen.findByRole('button', { name: /Tạo đơn hàng mới/i });
    fireEvent.click(createBtn);

    expect(screen.getByText('Tạo đơn hàng sản xuất mới')).toBeInTheDocument();

    const customCheckbox = screen.getByLabelText(/Đơn gia công tuỳ chỉnh/i) as HTMLInputElement;
    const ppSampleCheckbox = screen.getByLabelText(/Cần làm mẫu PP/i) as HTMLInputElement;

    expect(customCheckbox.checked).toBe(false);
    expect(ppSampleCheckbox.checked).toBe(false);

    // When custom is checked, ppSampleRequired is automatically checked and disabled (BR-17)
    fireEvent.click(customCheckbox);

    expect(customCheckbox.checked).toBe(true);
    expect(ppSampleCheckbox.checked).toBe(true);
    expect(ppSampleCheckbox.disabled).toBe(true);
  });

  it('BR-04: allows selecting fabric and loads compatible colors in fabric-color modal', async () => {
    renderWithClient(<OrdersPage />);

    const selectFcBtn = await screen.findByRole('button', { name: /Vải & Màu/i });
    fireEvent.click(selectFcBtn);

    expect(screen.getByText(/Chất liệu & Màu sắc: PO-2026-0001/i)).toBeInTheDocument();

    const fabricSelect = screen.getByLabelText(/Loại vải \(Fabric Type\)/i) as HTMLSelectElement;
    fireEvent.change(fabricSelect, { target: { value: 'fab-1' } });

    expect(api.fetchAllowedColors).toHaveBeenCalledWith('fab-1');
    expect(await screen.findByText('INDIGO-DARK - Xanh Chàm Đậm')).toBeInTheDocument();
  });

  it('BR-05: locks fabric/color editing when CUTTING has started (order IN_PRODUCTION)', async () => {
    const cuttingOrder: api.ProductionOrderItem = {
      ...mockOrders[0]!,
      id: 'order-cutting',
      orderNumber: 'PO-2026-0099',
      status: 'IN_PRODUCTION',
    };
    vi.spyOn(api, 'fetchOrdersApi').mockResolvedValue([cuttingOrder]);

    renderWithClient(<OrdersPage />);

    const selectFcBtn = await screen.findByRole('button', { name: /Vải & Màu/i });
    fireEvent.click(selectFcBtn);

    expect(await screen.findByText(/Khóa chỉnh sửa \(BR-05\)/i)).toBeInTheDocument();
    const fabricSelect = screen.getByLabelText(/Loại vải \(Fabric Type\)/i) as HTMLSelectElement;
    expect(fabricSelect.disabled).toBe(true);
    expect(screen.queryByRole('button', { name: /Lưu lựa chọn/i })).not.toBeInTheDocument();
  });

  it('FR-09: opens BOM modal and displays material lines', async () => {
    renderWithClient(<OrdersPage />);

    const bomBtn = await screen.findByRole('button', { name: /BOM/i });
    fireEvent.click(bomBtn);

    expect(
      await screen.findByText(/Định mức nguyên phụ liệu \(BOM\) — PO-2026-0001/i),
    ).toBeInTheDocument();
    expect(await screen.findByText(/Vải chính/i)).toBeInTheDocument();
    expect(screen.getByText('382.5')).toBeInTheDocument();
    expect(screen.getByText('METER')).toBeInTheDocument();
    expect(screen.getByText(/Nút kim loại/i)).toBeInTheDocument();
    expect(screen.getByText('250')).toBeInTheDocument();
    expect(screen.getByText('PIECE')).toBeInTheDocument();
  });

  it('FR-09: triggers BOM calculation when clicking recalculate', async () => {
    renderWithClient(<OrdersPage />);

    const bomBtn = await screen.findByRole('button', { name: /BOM/i });
    fireEvent.click(bomBtn);

    const recalcBtn = await screen.findByRole('button', { name: /Tính lại BOM/i });
    fireEvent.click(recalcBtn);

    await waitFor(() => {
      expect(api.calculateBomApi).toHaveBeenCalledWith('order-1', 'planner-token');
    });
  });

  describe('Confirm Order & Snapshot (T3.5, FR-07, FR-11, BR-03, BR-18, BR-19)', () => {
    it('T3.5: opens Confirm Order modal and successfully confirms order', async () => {
      vi.spyOn(api, 'confirmOrderApi').mockResolvedValue({
        success: true,
        orderId: 'order-1',
        orderNumber: 'PO-2026-0001',
        status: 'CONFIRMED',
        workflowInstanceId: 'inst-1',
        versionNo: 1,
        qcProfileType: 'FULL_PROCESS',
        stepInstancesCount: 5,
        firstReadyStepCode: 'FABRIC_INSPECT',
        skippedStepCodes: [],
      });

      renderWithClient(<OrdersPage />);

      const confirmBtn = await screen.findByRole('button', { name: /^Xác nhận$/i });
      fireEvent.click(confirmBtn);

      expect(
        await screen.findByText(/Xác nhận Đơn hàng & Khởi chạy Quy trình/i),
      ).toBeInTheDocument();

      const submitBtn = screen.getByRole('button', { name: /Xác nhận & Khởi chạy/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(api.confirmOrderApi).toHaveBeenCalledWith('order-1', 'planner-token');
      });

      expect(await screen.findByText(/Đơn hàng đã được xác nhận thành công!/i)).toBeInTheDocument();
      expect(screen.getByText(/v1/i)).toBeInTheDocument();
      expect(screen.getByText(/5 bước/i)).toBeInTheDocument();
    });

    it('T3.5: enforces BR-19 Customer Acknowledgement input when skipCleanWash is true', async () => {
      const skipWashOrder: api.ProductionOrderItem = {
        ...mockOrders[0]!,
        id: 'order-skip',
        orderNumber: 'PO-2026-0002',
        skipCleanWash: true,
      };
      vi.spyOn(api, 'fetchOrdersApi').mockResolvedValue([skipWashOrder]);
      vi.spyOn(api, 'attachAcknowledgementApi').mockResolvedValue({ id: 'ack-1' });
      vi.spyOn(api, 'confirmOrderApi').mockResolvedValue({
        success: true,
        orderId: 'order-skip',
        orderNumber: 'PO-2026-0002',
        status: 'CONFIRMED',
        workflowInstanceId: 'inst-skip',
        versionNo: 1,
        qcProfileType: 'SKIP_CLEAN_WASH',
        stepInstancesCount: 5,
        firstReadyStepCode: 'FABRIC_INSPECT',
        skippedStepCodes: ['CLEAN_WASH'],
      });

      renderWithClient(<OrdersPage />);

      const confirmBtn = await screen.findByRole('button', { name: /^Xác nhận$/i });
      fireEvent.click(confirmBtn);

      expect(
        await screen.findByText(/Yêu cầu văn bản xác nhận của khách hàng \(BR-19\)/i),
      ).toBeInTheDocument();

      const nameInput = screen.getByLabelText(/Người đại diện khách hàng ký nhận/i);
      const fileInput = screen.getByLabelText(/Đường dẫn \/ Tên tệp văn bản đính kèm/i);

      fireEvent.change(nameInput, { target: { value: 'Khách hàng ABC' } });
      fireEvent.change(fileInput, { target: { value: 'uploads/ack-signed.pdf' } });

      const submitBtn = screen.getByRole('button', { name: /Xác nhận & Khởi chạy/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(api.attachAcknowledgementApi).toHaveBeenCalledWith(
          'order-skip',
          {
            acknowledgedByName: 'Khách hàng ABC',
            filePath: 'uploads/ack-signed.pdf',
          },
          'planner-token',
        );
      });

      await waitFor(() => {
        expect(api.confirmOrderApi).toHaveBeenCalledWith('order-skip', 'planner-token');
      });

      expect(await screen.findByText(/Đơn hàng đã được xác nhận thành công!/i)).toBeInTheDocument();
      expect(screen.getByText('CLEAN_WASH')).toBeInTheDocument();
    });

    it('T3.5: disables confirm button when order isCustom is true (BR-17)', async () => {
      const customOrder: api.ProductionOrderItem = {
        ...mockOrders[0]!,
        id: 'order-custom',
        orderNumber: 'PO-2026-0003',
        isCustom: true,
      };
      vi.spyOn(api, 'fetchOrdersApi').mockResolvedValue([customOrder]);

      renderWithClient(<OrdersPage />);

      const confirmBtn = await screen.findByRole('button', { name: /^Xác nhận$/i });
      fireEvent.click(confirmBtn);

      expect(await screen.findByText(/Đơn hàng tuỳ chỉnh \(BR-17, R-04\)/i)).toBeInTheDocument();
      const submitBtn = screen.getByRole('button', {
        name: /Xác nhận & Khởi chạy/i,
      }) as HTMLButtonElement;
      expect(submitBtn.disabled).toBe(true);
    });
  });

  it('T5.3 (FR-18): opens defects modal and displays defects per bundle and inspection', async () => {
    vi.spyOn(api, 'fetchOrderDefectsApi').mockResolvedValue([
      {
        id: 'def-1',
        inspectionId: 'insp-1',
        stepCode: 'SEWING',
        stepName: 'May ráp',
        bundleId: 'bun-1',
        bundleCode: 'BUN-01',
        size: '30',
        defectType: 'SEAM_BURST',
        qty: 3,
        inspectorName: 'QC Inspector 1',
        createdAt: new Date('2026-10-18T10:00:00Z').toISOString(),
      },
    ]);

    renderWithClient(<OrdersPage />);

    const defectBtn = await screen.findByRole('button', { name: /^Lỗi$/i });
    fireEvent.click(defectBtn);

    expect(
      await screen.findByText(/Danh sách lỗi đơn hàng PO-2026-0001 \(FR-18\)/i),
    ).toBeInTheDocument();
    expect(await screen.findByText('May ráp (SEWING)')).toBeInTheDocument();
    expect(screen.getByText('BUN-01')).toBeInTheDocument();
    expect(screen.getByText('SEAM_BURST')).toBeInTheDocument();
    expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1);
  });

  describe('T5.4 Packing and Handover (FR-26)', () => {
    it('blocks handover creation when FINAL_QC is not DONE', async () => {
      const orderInProd: api.ProductionOrderItem = {
        ...mockOrders[0]!,
        id: 'order-in-prod-1',
        orderNumber: 'PO-2026-0001',
        status: 'IN_PRODUCTION',
        skipCleanWash: false,
        workflowInstance: {
          stepInstances: [
            {
              stepDefinition: { code: 'FINAL_QC', name: 'Final QC' },
              status: 'WAITING_QC',
            },
          ],
        },
      };
      vi.spyOn(api, 'fetchOrdersApi').mockResolvedValue([orderInProd]);
      vi.spyOn(api, 'fetchHandoverApi').mockResolvedValue(null);

      renderWithClient(<OrdersPage />);

      const handoverBtn = await screen.findByRole('button', { name: /^Bàn giao$/i });
      fireEvent.click(handoverBtn);

      expect(
        await screen.findByText(
          /Chưa thể bàn giao: Công đoạn kiểm tra chất lượng cuối cùng \(FINAL_QC\) chưa hoàn thành \(DONE\)/i,
        ),
      ).toBeInTheDocument();
      expect(screen.getByText('FULL_PROCESS')).toBeInTheDocument();
      const submitBtn = screen.getByRole('button', {
        name: /Tạo biên bản bàn giao & Hoàn tất đơn/i,
      }) as HTMLButtonElement;
      expect(submitBtn.disabled).toBe(true);
    });

    it('creates handover record showing SKIP_CLEAN_WASH when FINAL_QC is DONE and skipCleanWash is true', async () => {
      const orderDoneQc: api.ProductionOrderItem = {
        ...mockOrders[0]!,
        id: 'order-done-qc',
        orderNumber: 'PO-2026-0002',
        status: 'IN_PRODUCTION',
        skipCleanWash: true,
        workflowInstance: {
          stepInstances: [
            {
              stepDefinition: { code: 'FINAL_QC', name: 'Final QC' },
              status: 'DONE',
            },
          ],
        },
      };
      vi.spyOn(api, 'fetchOrdersApi').mockResolvedValue([orderDoneQc]);
      vi.spyOn(api, 'fetchHandoverApi').mockResolvedValue(null);
      vi.spyOn(api, 'createHandoverApi').mockResolvedValue({
        id: 'hand-1',
        orderId: 'order-done-qc',
        orderNumber: 'PO-2026-0002',
        qcProfileId: 'prof-skip',
        qcProfileType: 'SKIP_CLEAN_WASH',
        packingList: [{ size: '29', plannedQty: 100, actualQty: 100 }],
        totalQty: 100,
        handedOverBy: 'user-planner',
        handedOverByName: 'Planner User',
        handedOverAt: new Date().toISOString(),
        orderStatus: 'COMPLETED',
      });

      renderWithClient(<OrdersPage />);

      const handoverBtn = await screen.findByRole('button', { name: /^Bàn giao$/i });
      fireEvent.click(handoverBtn);

      expect(await screen.findByText('SKIP_CLEAN_WASH')).toBeInTheDocument();
      expect(
        screen.queryByText(/Chưa thể bàn giao: Công đoạn kiểm tra chất lượng cuối cùng/i),
      ).not.toBeInTheDocument();

      const submitBtn = screen.getByRole('button', {
        name: /Tạo biên bản bàn giao & Hoàn tất đơn/i,
      }) as HTMLButtonElement;
      expect(submitBtn.disabled).toBe(false);

      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(api.createHandoverApi).toHaveBeenCalledWith(
          'order-done-qc',
          expect.anything(),
          expect.anything(),
        );
      });
    });
  });
});
