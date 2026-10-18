import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
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
});
