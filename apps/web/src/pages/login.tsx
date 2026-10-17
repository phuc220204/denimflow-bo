import { Role } from '@denimflow/shared';
import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { useAuth } from '../lib/auth-context';
import { i18n } from '../lib/i18n/dictionary';

export const LoginPage: React.FC = () => {
  const { login, register, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState<'login' | 'register'>('login');

  // Login states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register states
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regRole, setRegRole] = useState<Role>(Role.PRODUCTION_PLANNER);

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
    if (!loginEmail) {
      setError('Vui lòng nhập địa chỉ email');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await login(loginEmail, loginPassword);
      navigate('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Đăng nhập không thành công');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regFullName.trim()) {
      setError('Vui lòng nhập họ và tên');
      return;
    }
    if (!regEmail.trim()) {
      setError('Vui lòng nhập địa chỉ email');
      return;
    }
    if (regPassword && regConfirmPassword && regPassword !== regConfirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await register({
        fullName: regFullName,
        email: regEmail,
        password: regPassword,
        role: regRole,
      });
      navigate('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Đăng ký không thành công');
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
          {/* Mode Switch Tabs */}
          <div className="grid grid-cols-2 border-b border-border" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`py-3 text-xs font-semibold transition-colors ${
                mode === 'login'
                  ? 'border-b-2 border-primary text-primary bg-surface'
                  : 'text-text-muted hover:text-text bg-background/50'
              }`}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`py-3 text-xs font-semibold transition-colors ${
                mode === 'register'
                  ? 'border-b-2 border-primary text-primary bg-surface'
                  : 'text-text-muted hover:text-text bg-background/50'
              }`}
            >
              Đăng ký
            </button>
          </div>

          <CardHeader className="pt-5 pb-3">
            <CardTitle className="text-base">
              {mode === 'login' ? 'Đăng nhập hệ thống' : 'Đăng ký tài khoản'}
            </CardTitle>
            <CardDescription className="text-xs">
              {mode === 'login'
                ? 'Nhập email và mật khẩu để bắt đầu làm việc'
                : 'Điền thông tin và chọn vị trí công tác trong xưởng'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 rounded bg-danger-tint border border-danger/20 text-danger-text text-xs">
                {error}
              </div>
            )}

            {mode === 'login' ? (
              /* Login Form */
              <form onSubmit={handleLogin} className="space-y-3.5">
                <Input
                  label="Email làm việc"
                  type="email"
                  placeholder="nhanvien@xuoing.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  disabled={isSubmitting}
                  autoFocus
                />

                <Input
                  label="Mật khẩu"
                  type="password"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
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
            ) : (
              /* Register Form */
              <form onSubmit={handleRegister} className="space-y-3.5">
                <Input
                  label="Họ và tên nhân viên"
                  type="text"
                  placeholder="Nguyễn Văn A"
                  value={regFullName}
                  onChange={(e) => setRegFullName(e.target.value)}
                  disabled={isSubmitting}
                  autoFocus
                />

                <Input
                  label="Email làm việc"
                  type="email"
                  placeholder="nhanvien@xuoing.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  disabled={isSubmitting}
                />

                <div className="space-y-1">
                  <label htmlFor="role-select" className="block text-sm font-medium text-text">
                    Vị trí công tác
                  </label>
                  <select
                    id="role-select"
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value as Role)}
                    disabled={isSubmitting}
                    className="flex h-9 w-full rounded border border-border bg-surface px-3 py-1 text-sm text-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <option value={Role.PRODUCTION_PLANNER}>Kế hoạch sản xuất</option>
                    <option value={Role.PROCESS_ENGINEER}>Kỹ thuật chuyền / Công nghệ may</option>
                    <option value={Role.QC_INSPECTOR}>Kiểm tra chất lượng (QC)</option>
                    <option value={Role.STATION_OPERATOR}>Công nhân may / Công đoạn</option>
                    <option value={Role.WAREHOUSE_KEEPER}>Quản lý kho nguyên phụ liệu</option>
                    <option value={Role.MANAGER}>Quản lý xưởng</option>
                    <option value={Role.ADMIN}>Quản trị viên hệ thống</option>
                  </select>
                </div>

                <Input
                  label="Mật khẩu"
                  type="password"
                  placeholder="Tối thiểu 6 ký tự"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  disabled={isSubmitting}
                />

                <Input
                  label="Xác nhận mật khẩu"
                  type="password"
                  placeholder="Nhập lại mật khẩu"
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  disabled={isSubmitting}
                />

                <Button type="submit" className="w-full mt-2" disabled={isSubmitting}>
                  {isSubmitting ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Footer info */}
        <p className="text-center text-xs text-text-muted">
          Hệ thống Quản lý Phân Xưởng May &bull; DenimFlow
        </p>
      </div>
    </div>
  );
};
