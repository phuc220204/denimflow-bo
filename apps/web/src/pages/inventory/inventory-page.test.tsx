import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Role } from '@denimflow/shared';
import * as api from '../../lib/api';
import { InventoryPage } from './inventory-page';

const mockKeeper = {
  id: 'keeper-uuid',
  email: 'keeper@denimflow.internal',
  fullName: 'Thủ Kho',
  role: Role.WAREHOUSE_KEEPER,
  isActive: true,
  token: 'keeper-token',
};

vi.mock('../../lib/auth-context', () => ({
  useAuth: () => ({
    user: mockKeeper,
    token: 'keeper-token',
    isLoading: false,
    logout: vi.fn(),
  }),
}));

const mockOrderAllocations: api.OrderAllocationItem[] = [
  {
    order: {
      id: 'order-1',
      orderNumber: 'PO-2026-0001',
      status: 'DRAFT',
      dueDate: '2026-11-20',
      customerRef: 'CUST-ALPHA',
      style: {
        id: 'style-1',
        styleCode: 'JN-SLIM-01',
        name: 'Quần Jean Slim Fit',
        fitType: 'SLIM',
        hasEmbroidery: false,
        isActive: true,
        createdAt: '2026-10-18T00:00:00.000Z',
        updatedAt: '2026-10-18T00:00:00.000Z',
      },
      fabricType: {
        id: 'fab-1',
        code: 'DENIM-12',
        name: 'Vải Denim 12oz',
        stretchType: 'RIGID',
        createdAt: '2026-10-18T00:00:00.000Z',
        updatedAt: '2026-10-18T00:00:00.000Z',
      },
      color: {
        id: 'col-1',
        code: 'INDIGO-DARK',
        name: 'Xanh Chàm Đậm',
        createdAt: '2026-10-18T00:00:00.000Z',
        updatedAt: '2026-10-18T00:00:00.000Z',
      },
    },
    fabricBomLine: {
      id: 'bom-1',
      requiredQty: 400,
      allocatedQty: 150,
      missingQty: 250,
      unit: 'meter',
      allocations: [],
      requests: [],
    },
    cuttingGate: {
      passed: false,
      ruleId: 'BR-06',
      reason:
        'BR-06: CUTTING may not start unless fabric is fully allocated per the BOM. Required: 400, Allocated: 150, Missing: 250.',
      requiredQty: 400,
      allocatedQty: 150,
      missingQty: 250,
    },
  },
];

const mockFabricLots: api.FabricLotItem[] = [
  {
    id: 'lot-1',
    lotNo: 'LOT-DN12-IND-01',
    fabricTypeId: 'fab-1',
    colorId: 'col-1',
    availableMeters: 500,
    shrinkagePercent: 2.5,
    fabricType: { id: 'fab-1', code: 'DENIM-12', name: 'Vải Denim 12oz' },
    colorOption: { id: 'col-1', code: 'INDIGO-DARK', name: 'Xanh Chàm Đậm' },
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
      <MemoryRouter initialEntries={['/inventory']}>
        <Routes>
          <Route path="/inventory" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('InventoryPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'fetchOrderAllocationsApi').mockResolvedValue(mockOrderAllocations);
    vi.spyOn(api, 'fetchFabricLotsApi').mockResolvedValue(mockFabricLots);
    vi.spyOn(api, 'fetchMaterialRequestsApi').mockResolvedValue([]);
    vi.spyOn(api, 'allocateFabricApi').mockResolvedValue({
      allocation: {
        id: 'alloc-1',
        bomLineId: 'bom-1',
        fabricLotId: 'lot-1',
        allocatedQty: 250,
      },
      remainingMissingQty: 0,
      isFullyAllocated: true,
    });
  });

  it('renders order allocations with BR-06 cutting gate blocked status', async () => {
    renderWithClient(<InventoryPage />);

    expect(await screen.findByText('PO-2026-0001')).toBeInTheDocument();
    expect(screen.getByText('Quần Jean Slim Fit')).toBeInTheDocument();
    expect(screen.getByText(/Còn thiếu: 250m/i)).toBeInTheDocument();
    expect(screen.getByText(/Khóa cắt \(Thiếu vải\)/i)).toBeInTheDocument();
  });

  it('opens allocation modal and submits fabric allocation', async () => {
    renderWithClient(<InventoryPage />);

    const allocBtn = await screen.findByRole('button', { name: /Phân bổ vải/i });
    fireEvent.click(allocBtn);

    expect(screen.getByText(/Phân bổ cuộn vải — PO-2026-0001/i)).toBeInTheDocument();
    expect(screen.getByText(/Tổng nhu cầu định mức:/i)).toBeInTheDocument();

    const lotSelect = screen.getByLabelText(/Chọn cuộn vải xuất xưởng/i) as HTMLSelectElement;
    fireEvent.change(lotSelect, { target: { value: 'lot-1' } });

    const submitBtn = screen.getByRole('button', { name: /Xác nhận phân bổ/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.allocateFabricApi).toHaveBeenCalledWith(
        {
          orderId: 'order-1',
          bomLineId: 'bom-1',
          fabricLotId: 'lot-1',
          quantity: 250,
        },
        'keeper-token',
      );
    });
  });
});
