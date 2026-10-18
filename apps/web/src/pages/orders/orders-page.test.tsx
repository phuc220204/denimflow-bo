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
});
