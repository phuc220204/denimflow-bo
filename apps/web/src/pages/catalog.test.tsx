import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogPage } from './catalog';

// Mock useAuth
vi.mock('../lib/auth-context', () => ({
  useAuth: () => ({
    user: {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'admin@denimflow.local',
      fullName: 'Quản Trị Viên',
      role: 'ADMIN',
      isActive: true,
    },
    token: 'admin-token',
    isLoading: false,
  }),
}));

// Mock catalog APIs
vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...actual,
    fetchStyles: vi.fn().mockResolvedValue([
      {
        id: 's-1',
        styleCode: 'JN-SLIM-01',
        name: 'Quần Jeans Slim Fit Nam',
        fitType: 'Slim',
        hasEmbroidery: false,
        isActive: true,
      },
    ]),
    fetchFabricTypes: vi.fn().mockResolvedValue([
      {
        id: 'f-1',
        code: 'DN-12-RIGID',
        name: 'Denim 12oz Không Co Giãn',
        weightOz: 12.0,
        composition: '100% Cotton',
        stretchType: 'RIGID',
      },
    ]),
    fetchColorOptions: vi.fn().mockResolvedValue([
      {
        id: 'c-1',
        code: 'CLR-INDIGO',
        name: 'Xanh Chàm Indigo',
        colorFamily: 'Xanh',
      },
    ]),
    fetchWashTypes: vi.fn().mockResolvedValue([
      {
        id: 'w-1',
        code: 'WSH-STONE',
        name: 'Giặt Mài Đá (Stone Wash)',
        description: 'Mài nhẹ tự nhiên',
      },
    ]),
    fetchStations: vi.fn().mockResolvedValue([
      {
        id: 'st-1',
        code: 'CUT-01',
        name: 'Xưởng Cắt Bán Thành Phẩm 01',
        stationType: 'CUTTING',
        isOutsourced: false,
      },
    ]),
    fetchMatrix: vi.fn().mockResolvedValue({
      fabrics: [
        {
          id: 'f-1',
          code: 'DN-12-RIGID',
          name: 'Denim 12oz Không Co Giãn',
          weightOz: 12.0,
          composition: '100% Cotton',
          stretchType: 'RIGID',
        },
      ],
      colors: [
        {
          id: 'c-1',
          code: 'CLR-INDIGO',
          name: 'Xanh Chàm Indigo',
          colorFamily: 'Xanh',
        },
      ],
      rules: [
        {
          id: 'r-1',
          fabricTypeId: 'f-1',
          colorId: 'c-1',
          isAllowed: true,
          note: 'Chuẩn màu',
        },
      ],
    }),
    toggleMatrixRuleApi: vi.fn().mockResolvedValue({
      id: 'r-1',
      fabricTypeId: 'f-1',
      colorId: 'c-1',
      isAllowed: false,
    }),
    fetchStyleQcProfiles: vi.fn().mockResolvedValue([
      {
        id: 'qc-1',
        styleId: 's-1',
        profileType: 'FULL_PROCESS',
        maxShrinkagePercent: 3.0,
        maxColorFadingLevel: 1,
        notes: 'Quy trình chuẩn',
        createdAt: '2026-10-18T00:00:00Z',
        updatedAt: '2026-10-18T00:00:00Z',
      },
      {
        id: 'qc-2',
        styleId: 's-1',
        profileType: 'SKIP_CLEAN_WASH',
        maxShrinkagePercent: 6.0,
        maxColorFadingLevel: 2,
        notes: 'Bỏ giặt sạch có cam kết',
        createdAt: '2026-10-18T00:00:00Z',
        updatedAt: '2026-10-18T00:00:00Z',
      },
    ]),
    updateStyleQcProfileApi: vi.fn().mockResolvedValue({
      id: 'qc-1',
      styleId: 's-1',
      profileType: 'FULL_PROCESS',
      maxShrinkagePercent: 3.5,
      maxColorFadingLevel: 1,
    }),
  };
});

describe('CatalogPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  it('renders catalog header and displays default styles tab with demo items', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <CatalogPage />
        </BrowserRouter>
      </QueryClientProvider>,
    );

    // Assert header
    expect(screen.getByText('Danh mục Dữ liệu Xưởng May')).toBeInTheDocument();
    expect(screen.getByText(/Thêm mới/i)).toBeInTheDocument();

    // Assert styles tab loaded
    await waitFor(() => {
      expect(screen.getByText('JN-SLIM-01')).toBeInTheDocument();
      expect(screen.getByText('Quần Jeans Slim Fit Nam')).toBeInTheDocument();
    });
  });

  it('switches between tabs and displays respective items', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <CatalogPage />
        </BrowserRouter>
      </QueryClientProvider>,
    );

    // Switch to Stations tab
    const stationTabBtn = screen.getByRole('button', { name: /Trạm sản xuất/i });
    fireEvent.click(stationTabBtn);

    await waitFor(() => {
      expect(screen.getByText('CUT-01')).toBeInTheDocument();
      expect(screen.getByText('Xưởng Cắt Bán Thành Phẩm 01')).toBeInTheDocument();
    });
  });

  it('switches to Fabric-Color Matrix tab and displays rule matrix (BR-02, T1.4)', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <CatalogPage />
        </BrowserRouter>
      </QueryClientProvider>,
    );

    const matrixTabBtn = screen.getByRole('button', { name: /Ma trận Vải/i });
    fireEvent.click(matrixTabBtn);

    await waitFor(() => {
      expect(screen.getByText(/Ma trận tương thích Vải/i)).toBeInTheDocument();
      expect(screen.getByText('DN-12-RIGID')).toBeInTheDocument();
      expect(screen.getByText('CLR-INDIGO')).toBeInTheDocument();
    });
  });

  it('switches to QC Profiles tab and displays threshold configurations (BR-19, T1.5)', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <CatalogPage />
        </BrowserRouter>
      </QueryClientProvider>,
    );

    const qcTabBtn = screen.getByRole('button', { name: /Tiêu chuẩn QC/i });
    fireEvent.click(qcTabBtn);

    await waitFor(() => {
      expect(screen.getAllByText('FULL_PROCESS').length).toBeGreaterThan(0);
      expect(screen.getAllByText('SKIP_CLEAN_WASH').length).toBeGreaterThan(0);
    });
  });
});
