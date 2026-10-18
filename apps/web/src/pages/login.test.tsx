import { act, render, screen } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AuthProvider } from '../lib/auth-context';
import { i18n } from '../lib/i18n/dictionary';
import { LoginPage } from './login';

describe('LoginPage', () => {
  it('renders standard login form with email and password fields', async () => {
    await act(async () => {
      render(
        <AuthProvider>
          <BrowserRouter>
            <LoginPage />
          </BrowserRouter>
        </AuthProvider>,
      );
    });

    // Assert main header and title
    expect(screen.getByText(i18n.app.title)).toBeInTheDocument();
    expect(screen.getByText('Đăng nhập hệ thống')).toBeInTheDocument();

    // Assert login fields
    expect(screen.getByLabelText('Email làm việc')).toBeInTheDocument();
    expect(screen.getByLabelText('Mật khẩu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đăng nhập' })).toBeInTheDocument();
  });
});
