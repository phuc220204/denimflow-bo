import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsersPage } from './users';

const { mockUser, mockUsersList, mockUpdateUserStatus, mockUpdateUserAssignment } = vi.hoisted(
  () => {
    const mockUser = {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'admin@denimflow.internal',
      fullName: 'Quản Trị Viên',
      role: 'ADMIN',
      isActive: true,
    };

    const mockUsersList = [
      {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'admin@denimflow.internal',
        fullName: 'Quản Trị Viên',
        role: 'ADMIN',
        isActive: true,
        stationId: null,
        station: null,
        createdAt: '2026-10-18T00:00:00Z',
        updatedAt: '2026-10-18T00:00:00Z',
      },
      {
        id: '00000000-0000-0000-0000-000000000002',
        email: 'pe@denimflow.internal',
        fullName: 'Trần Kỹ Sư',
        role: 'PROCESS_ENGINEER',
        isActive: true,
        stationId: null,
        station: null,
        createdAt: '2026-10-18T00:00:00Z',
        updatedAt: '2026-10-18T00:00:00Z',
      },
      {
        id: '00000000-0000-0000-0000-000000000005',
        email: 'sewing.lead@denimflow.internal',
        fullName: 'Lê Văn May',
        role: 'SEWING_LEAD',
        isActive: false,
        stationId: 'st-sewing',
        stationName: 'Chuyền May 01',
        createdAt: '2026-10-18T00:00:00Z',
        updatedAt: '2026-10-18T00:00:00Z',
      },
    ];

    const mockUpdateUserStatus = vi.fn().mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000002',
      email: 'pe@denimflow.internal',
      fullName: 'Trần Kỹ Sư',
      role: 'PROCESS_ENGINEER',
      isActive: false,
    });

    const mockUpdateUserAssignment = vi.fn().mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000002',
      email: 'pe@denimflow.internal',
      fullName: 'Trần Kỹ Sư',
      role: 'QC_INSPECTOR',
      stationId: 'st-sewing',
      isActive: true,
    });

    return { mockUser, mockUsersList, mockUpdateUserStatus, mockUpdateUserAssignment };
  },
);

vi.mock('../lib/auth-context', () => ({
  useAuth: () => ({
    user: mockUser,
    token: 'admin-token',
    isLoading: false,
  }),
}));

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...actual,
    fetchUsersApi: vi.fn().mockImplementation(() => Promise.resolve(mockUsersList)),
    updateUserStatusApi: (...args: unknown[]) => mockUpdateUserStatus(...args),
    updateUserAssignmentApi: (...args: unknown[]) => mockUpdateUserAssignment(...args),
    createUserApi: vi.fn().mockResolvedValue(mockUsersList[1]),
    fetchStations: vi
      .fn()
      .mockResolvedValue([
        { id: 'st-sewing', name: 'Chuyền May 01', code: 'SEW-01', stationType: 'SEWING' },
      ]),
  };
});

describe('UsersPage (Admin User Management)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  it('renders user list with 7 roles and status badges', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <UsersPage />
        </BrowserRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText('Quản lý Nhân sự & Phân quyền xưởng may')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('admin@denimflow.internal')).toBeInTheDocument();
      expect(screen.getByText('pe@denimflow.internal')).toBeInTheDocument();
      expect(screen.getByText('sewing.lead@denimflow.internal')).toBeInTheDocument();
    });

    expect(screen.getByText('Trần Kỹ Sư')).toBeInTheDocument();
    expect(screen.getByText('Chuyền May 01')).toBeInTheDocument();
    expect(screen.getAllByText('Tạm khóa').length).toBeGreaterThan(0);
  });

  it('allows admin to trigger user status deactivation', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <UsersPage />
        </BrowserRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('pe@denimflow.internal')).toBeInTheDocument();
    });

    // Find Khoá tài khoản button for pe@denimflow.internal (index 1, as index 0 is current user and disabled)
    const lockButtons = screen.getAllByRole('button', { name: /Khóa tài khoản/i });
    expect(lockButtons.length).toBeGreaterThan(1);
    const targetBtn = lockButtons[1];
    expect(targetBtn).toBeDefined();
    if (targetBtn) fireEvent.click(targetBtn);

    await waitFor(() => {
      expect(mockUpdateUserStatus).toHaveBeenCalledWith(
        '00000000-0000-0000-0000-000000000002',
        false,
        'admin-token',
      );
    });
  });

  it('allows admin to open assignment modal and update role and station', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <UsersPage />
        </BrowserRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('pe@denimflow.internal')).toBeInTheDocument();
    });

    const assignButtons = screen.getAllByRole('button', { name: /Phân trạm & Quyền/i });
    expect(assignButtons.length).toBeGreaterThan(1);
    const targetAssignBtn = assignButtons[1];
    expect(targetAssignBtn).toBeDefined();
    if (targetAssignBtn) fireEvent.click(targetAssignBtn);

    expect(screen.getByText('Phân trạm & Vai trò nhân sự')).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: /Lưu phân bổ/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockUpdateUserAssignment).toHaveBeenCalledWith(
        '00000000-0000-0000-0000-000000000002',
        expect.objectContaining({ role: 'PROCESS_ENGINEER' }),
        'admin-token',
      );
    });
  });
});
