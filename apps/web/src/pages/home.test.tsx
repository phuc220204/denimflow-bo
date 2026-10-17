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
      user: actual.DEMO_USERS['admin@denimflow.local'],
      token: 'mock-token',
      isLoading: false,
      login: vi.fn(),
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

  it('renders user profile and fetches health status from MSW', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <HomePage />
        </BrowserRouter>
      </QueryClientProvider>,
    );

    // Assert user profile
    expect(screen.getByText(/Xin chào, Trần Văn Quản Trị!/i)).toBeInTheDocument();
    expect(screen.getByText('admin@denimflow.local')).toBeInTheDocument();
    expect(screen.getAllByText('Quản trị viên').length).toBeGreaterThanOrEqual(1);

    // Assert /health status loaded from MSW
    await waitFor(() => {
      expect(screen.getByText(/Sẵn sàng \(HTTP 200\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Đã kết nối \(UP\)/i)).toBeInTheDocument();
    });
  });
});
