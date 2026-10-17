import { Shield, UserCheck } from 'lucide-react';
import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { DEMO_USERS, useAuth } from '../lib/auth-context';
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Vui lòng nhập địa chỉ email');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : i18n.auth.invalidCredentials;
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectDemoUser = async (demoEmail: string) => {
    setError(null);
    setIsSubmitting(true);
    try {
      await login(demoEmail);
      navigate('/');
    } catch {
      setError(i18n.auth.invalidCredentials);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 rounded bg-primary text-white items-center justify-center font-bold text-xl mb-1">
            DF
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-text">{i18n.app.title}</h1>
          <p className="text-sm text-text-muted">{i18n.app.subtitle}</p>
        </div>

        {/* Login Card */}
        <Card className="border border-border bg-surface shadow-sm">
          <CardHeader>
            <CardTitle>{i18n.auth.loginTitle}</CardTitle>
            <CardDescription>{i18n.auth.loginSubtitle}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label={i18n.auth.emailLabel}
                type="email"
                placeholder={i18n.auth.emailPlaceholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                autoFocus
              />

              <Input
                label={i18n.auth.passwordLabel}
                type="password"
                placeholder={i18n.auth.passwordPlaceholder}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
              />

              {error && (
                <div className="p-3 rounded bg-danger-tint border border-danger/20 text-danger-text text-sm">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? i18n.auth.loggingIn : i18n.auth.loginButton}
              </Button>
            </form>

            {/* Quick Demo Logins for Testing & Evaluation */}
            <div className="pt-4 border-t border-border space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">
                <UserCheck className="h-3.5 w-3.5" />
                <span>{i18n.auth.demoQuickLogin}</span>
              </div>
              <p className="text-xs text-text-muted">
                Bấm vào một vai trò dưới đây để đăng nhập kiểm thử tức thì:
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                {Object.values(DEMO_USERS).map((u) => (
                  <button
                    key={u.email}
                    type="button"
                    onClick={() => handleSelectDemoUser(u.email)}
                    disabled={isSubmitting}
                    className="flex flex-col items-start p-2 rounded border border-border hover:border-primary hover:bg-primary-tint/50 text-left transition-colors"
                  >
                    <span className="text-xs font-medium text-text">{u.fullName}</span>
                    <Badge tone="info" className="mt-1 text-[10px] px-1.5 py-0">
                      {i18n.roles[u.role] || u.role}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security Footer Notice */}
        <div className="text-center flex items-center justify-center gap-1.5 text-xs text-text-muted">
          <Shield className="h-3.5 w-3.5" />
          <span>Hệ thống chỉ dành cho cán bộ công nhân viên được cấp quyền</span>
        </div>
      </div>
    </div>
  );
};
