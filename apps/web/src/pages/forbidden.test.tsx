import { render, screen } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ForbiddenPage } from './forbidden';

vi.mock('../lib/auth-context', () => ({
  useAuth: () => ({
    user: {
      id: '00000000-0000-0000-0000-000000000002',
      email: 'pe@denimflow.internal',
      fullName: 'Kỹ Sư Quy Trình',
      role: 'PROCESS_ENGINEER',
      isActive: true,
    },
    token: 'pe-token',
    isLoading: false,
  }),
}));

describe('ForbiddenPage (403)', () => {
  it('renders 403 error message with user role and navigation back button', () => {
    render(
      <BrowserRouter>
        <ForbiddenPage />
      </BrowserRouter>,
    );

    expect(screen.getByText(/Mã lỗi 403/i)).toBeInTheDocument();
    expect(screen.getByText('Khu vực giới hạn quyền hạn')).toBeInTheDocument();
    expect(screen.getByText('Kỹ sư quy trình')).toBeInTheDocument();
    expect(screen.getByText(/Về bàn làm việc của tôi/i)).toBeInTheDocument();
  });
});
