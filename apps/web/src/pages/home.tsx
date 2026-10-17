import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  CheckCircle2,
  Database,
  Layers,
  RefreshCw,
  Server,
  UserCircle,
  XCircle,
} from 'lucide-react';
import React from 'react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { fetchHealth } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { i18n } from '../lib/i18n/dictionary';

export const HomePage: React.FC = () => {
  const { user } = useAuth();

  const {
    data: health,
    isLoading: isHealthLoading,
    isError: isHealthError,
    error: healthError,
    refetch: refetchHealth,
    isFetching: isHealthFetching,
  } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 30000, // 30s auto poll
    retry: 1,
  });

  const roleLabel = user ? i18n.roles[user.role] || user.role : '';

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text">
            {i18n.home.welcome}, {user?.fullName}!
          </h1>
          <p className="text-sm text-text-muted">{i18n.home.systemNotice}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="info" className="text-xs">
            {roleLabel}
          </Badge>
          <Badge tone="neutral" className="text-xs">
            Sprint 0: Walking Skeleton
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* User Profile Card (shows /me data) */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <UserCircle className="h-5 w-5 text-primary" />
              <CardTitle>{i18n.home.profileSectionTitle}</CardTitle>
            </div>
            <CardDescription>Dữ liệu xác thực từ phiên đăng nhập hiện tại</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between py-1.5 border-b border-border text-sm">
              <span className="text-text-muted">{i18n.home.fullNameLabel}</span>
              <span className="font-semibold text-text">{user?.fullName}</span>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-border text-sm">
              <span className="text-text-muted">{i18n.home.emailLabel}</span>
              <span className="font-mono text-text text-xs">{user?.email}</span>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-border text-sm">
              <span className="text-text-muted">{i18n.home.roleLabel}</span>
              <div className="flex items-center gap-1.5">
                <Badge tone="primary">{roleLabel}</Badge>
                <span className="text-xs font-mono text-text-muted">({user?.role})</span>
              </div>
            </div>

            <div className="flex items-center justify-between py-1.5 text-sm">
              <span className="text-text-muted">{i18n.home.statusLabel}</span>
              <Badge tone={user?.isActive ? 'success' : 'danger'}>
                {user?.isActive ? i18n.home.activeStatus : 'Bị khoá'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* API & Database Health Card (shows /health data) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                <CardTitle>{i18n.home.apiHealthSectionTitle}</CardTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchHealth()}
                disabled={isHealthFetching}
                className="gap-1.5 text-xs h-7"
              >
                <RefreshCw className={`h-3 w-3 ${isHealthFetching ? 'animate-spin' : ''}`} />
                <span>{i18n.home.refreshStatus}</span>
              </Button>
            </div>
            <CardDescription>
              Kiểm tra tình trạng sống của NestJS API và kết nối Database
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* API Service Status */}
            <div className="flex items-center justify-between py-1.5 border-b border-border text-sm">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-text-muted" />
                <span className="text-text-muted">{i18n.home.apiStatusLabel}</span>
              </div>
              {isHealthLoading ? (
                <span className="text-xs text-text-muted">{i18n.common.loading}</span>
              ) : health?.status === 'ok' ? (
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <Badge tone="success">Sẵn sàng (HTTP 200)</Badge>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <XCircle className="h-4 w-4 text-danger" />
                  <Badge tone="danger">Không khả dụng</Badge>
                </div>
              )}
            </div>

            {/* Database Connection Status */}
            <div className="flex items-center justify-between py-1.5 border-b border-border text-sm">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-text-muted" />
                <span className="text-text-muted">{i18n.home.dbStatusLabel}</span>
              </div>
              {isHealthLoading ? (
                <span className="text-xs text-text-muted">{i18n.common.loading}</span>
              ) : health?.db === 'up' ? (
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <Badge tone="success">Đã kết nối (UP)</Badge>
                </div>
              ) : health?.db === 'down' ? (
                <div className="flex items-center gap-1.5">
                  <XCircle className="h-4 w-4 text-danger" />
                  <Badge tone="danger">Mất kết nối (DOWN)</Badge>
                </div>
              ) : (
                <Badge tone="warning">Chưa rõ</Badge>
              )}
            </div>

            {/* Detailed error if any */}
            {isHealthError && (
              <div className="p-2.5 rounded bg-warning-tint border border-warning/20 text-warning-text text-xs">
                Không thể gọi tới API ({healthError?.message || 'Lỗi mạng'}). Backend có thể đang
                tắt hoặc cần chạy `pnpm --filter @denimflow/api dev`.
              </div>
            )}
          </CardContent>
          <CardFooter className="text-xs text-text-muted justify-between">
            <span>
              Endpoint: <code className="font-mono text-primary">GET /health</code>
            </span>
            <span>Tần suất tự động: 30s</span>
          </CardFooter>
        </Card>
      </div>

      {/* System Architecture Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <CardTitle>{i18n.home.systemOverviewTitle}</CardTitle>
          </div>
          <CardDescription>
            Kiến trúc Modular Monolith & Clean Architecture (Option B)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="p-3 rounded border border-border bg-background space-y-1">
              <span className="font-semibold text-text block">1. Dynamic Workflow Engine</span>
              <p className="text-xs text-text-muted">
                `packages/engine`: Pure TypeScript không phụ thuộc framework, cài đặt State Machine,
                Chain of Responsibility (Gates), Strategy (BOM, điều kiện rẽ nhánh).
              </p>
            </div>

            <div className="p-3 rounded border border-border bg-background space-y-1">
              <span className="font-semibold text-text block">2. API & Data Layer</span>
              <p className="text-xs text-text-muted">
                `apps/api`: NestJS, Prisma ORM, Supabase PostgreSQL. RLS deny-all, lưu trữ AuditLog
                bất biến (BR-16) cho mọi tác vụ đa dòng.
              </p>
            </div>

            <div className="p-3 rounded border border-border bg-background space-y-1">
              <span className="font-semibold text-text block">
                3. Single Language UI (Tiếng Việt)
              </span>
              <p className="text-xs text-text-muted">
                `apps/web`: React + Vite + Tailwind + shadcn/ui. Thiết kế phẳng chuẩn nghiệp vụ, từ
                điển tiếng Việt thống nhất theo DESIGN.md.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
