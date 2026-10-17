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

  it('renders user account details and system health telemetry', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <HomePage />
        </BrowserRouter>
      </QueryClientProvider>,
    );

    // Assert role-specific workspace header displayed
    expect(screen.getByText(/Bàn làm việc Quản trị viên hệ thống/i)).toBeInTheDocument();
    expect(screen.getAllByText('admin@denimflow.local').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Quản trị viên').length).toBeGreaterThan(0);

    // Assert telemetry loaded from MSW
    await waitFor(() => {
      expect(screen.getByText(/Đang hoạt động tốt/i)).toBeInTheDocument();
      expect(screen.getByText(/Đã đồng bộ an toàn/i)).toBeInTheDocument();
    });
  });
});
