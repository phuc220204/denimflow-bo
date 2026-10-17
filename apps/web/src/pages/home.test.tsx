import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HomePage } from './home';

// Mock useAuth hook to return logged in admin
vi.mock('../lib/auth-context', async () => {
  const actual = await vi.importActual<typeof import('../lib/auth-context')>('../lib/auth-context');
  return {
    ...actual,
    useAuth: () => ({
      user: {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'admin@denimflow.local',
        fullName: 'Trần Văn Quản Trị',
        role: 'ADMIN',
        isActive: true,
      },
      token: 'mock-token',
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    }),
  };
});

describe('HomePage', () => {
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

  it('renders operation center and fetches health telemetry from MSW', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <HomePage />
        </BrowserRouter>
      </QueryClientProvider>,
    );

    // Assert shift role and operator
    expect(screen.getByText(/Quản trị viên — Bàn Điều Hành Trực Tiếp/i)).toBeInTheDocument();
    expect(screen.getByText('Trần Văn Quản Trị')).toBeInTheDocument();

    // Assert pipeline and telemetry loaded from MSW
    expect(screen.getByText(/Chuỗi Công Đoạn Mẫu Jean Tiêu Chuẩn/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/Sẵn sàng \(200\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Postgres \(UP\)/i)).toBeInTheDocument();
    });
  });
});
