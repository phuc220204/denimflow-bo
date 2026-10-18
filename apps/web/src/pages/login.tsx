import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { useAuth } from '../lib/auth-context';
import { i18n } from '../lib/i18n/dictionary';

export const LoginPage: React.FC = () => {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If already logged in, redirect
  React.useEffect(() => {
    if (user) {
      const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';
      navigate(from, { replace: true });
    }
  }, [user, navigate, location]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Vui lòng nhập địa chỉ email');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Đăng nhập không thành công');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-[420px] space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-11 w-11 rounded bg-primary text-white items-center justify-center font-bold text-base tracking-wider mb-1">
            DF
          </div>
          <h1 className="text-xl font-bold tracking-tight text-text">{i18n.app.title}</h1>
          <p className="text-xs text-text-muted">{i18n.app.subtitle}</p>
        </div>

        {/* Auth Card */}
        <Card className="border border-border bg-surface shadow-sm">
          <CardHeader className="pt-5 pb-3">
            <CardTitle className="text-base">Đăng nhập hệ thống</CardTitle>
            <CardDescription className="text-xs">
              Nhập email và mật khẩu nội bộ để bắt đầu làm việc
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 rounded bg-danger-tint border border-danger/20 text-danger-text text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-3.5">
              <Input
                label="Email làm việc"
                type="email"
                placeholder="nhanvien@xuoing.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                autoFocus
              />

              <Input
                label="Mật khẩu"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
              />

              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-1.5 text-text-muted cursor-pointer">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="rounded border-border text-primary focus:ring-primary"
                  />
                  <span>Ghi nhớ đăng nhập</span>
                </label>
                <span className="text-text-muted hover:text-primary cursor-pointer">
                  Quên mật khẩu?
                </span>
              </div>

              <Button type="submit" className="w-full mt-2" disabled={isSubmitting}>
                {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer info */}
        <p className="text-center text-xs text-text-muted">
          Hệ thống Quản lý Phân Xưởng May &bull; DenimFlow BO
        </p>
      </div>
    </div>
  );
};
