import { useQuery } from '@tanstack/react-query';
import { Activity, CheckCircle2, Database, LogOut, User } from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { fetchHealth } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { i18n } from '../lib/i18n/dictionary';

export const HomePage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const {
    data: health,
    isLoading: isHealthLoading,
    refetch: refetchHealth,
    isFetching: isHealthFetching,
  } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 30000,
    retry: 1,
  });

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const roleLabel = user ? i18n.roles[user.role] || user.role : '';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Header */}
      <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 font-bold text-white shadow-sm">
            DF
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-900">DenimFlow</h1>
            <p className="text-xs text-slate-500">Hệ thống Quản lý Xưởng May Gia Công</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden text-right sm:block">
            <div className="text-sm font-medium text-slate-800">
              {user?.fullName || 'Nhân viên'}
            </div>
            <div className="text-xs text-slate-500">{user?.email}</div>
          </div>
          <Badge tone="outline" className="border-blue-200 bg-blue-50 text-blue-700">
            {roleLabel}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="flex items-center gap-2 border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-red-600"
          >
            <LogOut className="h-4 w-4" />
            <span>Đăng xuất</span>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Chào mừng, {user?.fullName || 'Bạn'}!
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Bạn đã đăng nhập thành công vào hệ thống làm việc của xưởng.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Thông tin nhân viên */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-base font-semibold">Thông tin nhân viên</CardTitle>
              </div>
              <CardDescription>Chi tiết tài khoản đang đăng nhập</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              <div>
                <label className="text-xs font-medium text-slate-500">Họ và tên</label>
                <div className="text-sm font-semibold text-slate-900">{user?.fullName}</div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Email đăng nhập</label>
                <div className="text-sm font-semibold text-slate-900">{user?.email}</div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Bộ phận / Vị trí</label>
                <div className="mt-1">
                  <Badge
                    tone="outline"
                    className="border-blue-200 bg-blue-50 font-medium text-blue-700"
                  >
                    {roleLabel}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2 text-xs font-medium text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                <span>Tài khoản hợp lệ và sẵn sàng làm việc</span>
              </div>
            </CardContent>
          </Card>

          {/* Tình trạng kết nối hệ thống */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-base font-semibold">Tình trạng hệ thống xưởng</CardTitle>
              </div>
              <CardDescription>Trạng thái kết nối của máy chủ và dữ liệu</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                <div className="flex items-center gap-3">
                  <Activity className="h-5 w-5 text-slate-500" />
                  <div>
                    <div className="text-sm font-medium text-slate-800">Máy chủ vận hành</div>
                    <div className="text-xs text-slate-500">Tiếp nhận và xử lý yêu cầu</div>
                  </div>
                </div>
                {isHealthLoading ? (
                  <span className="text-xs text-slate-400">Đang kiểm tra...</span>
                ) : health?.status === 'ok' ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Đang hoạt động tốt
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    Chưa kết nối
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                <div className="flex items-center gap-3">
                  <Database className="h-5 w-5 text-slate-500" />
                  <div>
                    <div className="text-sm font-medium text-slate-800">Dữ liệu phân xưởng</div>
                    <div className="text-xs text-slate-500">Lưu trữ đơn hàng & tài khoản</div>
                  </div>
                </div>
                {isHealthLoading ? (
                  <span className="text-xs text-slate-400">Đang kiểm tra...</span>
                ) : health?.db === 'up' ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Đã đồng bộ an toàn
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    Chưa kết nối
                  </span>
                )}
              </div>

              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchHealth()}
                  disabled={isHealthFetching}
                  className="w-full text-xs"
                >
                  {isHealthFetching ? 'Đang kiểm tra...' : 'Kiểm tra lại kết nối'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};
