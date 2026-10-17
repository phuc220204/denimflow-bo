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
});
