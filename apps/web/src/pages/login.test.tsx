import { act, render, screen } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AuthProvider } from '../lib/auth-context';
import { i18n } from '../lib/i18n/dictionary';
import { LoginPage } from './login';

describe('LoginPage', () => {
  it('renders login form and demo quick login options', async () => {
    await act(async () => {
      render(
        <AuthProvider>
          <BrowserRouter>
            <LoginPage />
          </BrowserRouter>
        </AuthProvider>,
      );
    });

    // Assert main header and Vietnamese labels
    expect(screen.getByText(i18n.app.title)).toBeInTheDocument();
    expect(screen.getByText(i18n.auth.loginTitle)).toBeInTheDocument();
    expect(screen.getByLabelText(i18n.auth.emailLabel)).toBeInTheDocument();
    expect(screen.getByLabelText(i18n.auth.passwordLabel)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.auth.loginButton })).toBeInTheDocument();

    // Assert demo quick logins
    expect(screen.getByText(i18n.auth.demoQuickLogin)).toBeInTheDocument();
    expect(screen.getByText('Trần Văn Quản Trị')).toBeInTheDocument();
    expect(screen.getByText('Quản trị viên')).toBeInTheDocument();
  });
});
