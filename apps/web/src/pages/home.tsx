import { Role } from '@denimflow/shared';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Database,
  Factory,
  FileCheck,
  FileSpreadsheet,
  GitFork,
  History,
  Layers,
  Package,
  Scissors,
  ShieldCheck,
  TrendingUp,
  User,
  Users,
} from 'lucide-react';
import React from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { fetchHealth } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { i18n } from '../lib/i18n/dictionary';

export const HomePage: React.FC = () => {
  const { user } = useAuth();

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

  const roleLabel = user ? i18n.roles[user.role] || user.role : '';

  // Render role-specific workspace modules based on who is logged in
  const renderRoleWorkspace = () => {
    switch (user?.role) {
      case Role.PRODUCTION_PLANNER:
        return (
          <div className="space-y-4">
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-5">
              <h3 className="text-lg font-bold text-blue-900">
                Bàn làm việc Kế hoạch & Điều độ sản xuất
              </h3>
              <p className="mt-1 text-sm text-blue-700">
                Lập kế hoạch đơn hàng gia công, phân bổ định mức vải may và điều phối tiến độ
                chuyền.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="border-slate-200 hover:border-blue-300 transition-colors cursor-pointer">
                <CardHeader className="pb-3">
                  <ClipboardList className="h-6 w-6 text-blue-600 mb-1" />
                  <CardTitle className="text-base font-semibold">Tạo đơn gia công mới</CardTitle>
                  <CardDescription className="text-xs">
                    Thiết lập mã hàng jeans, số lượng size và màu sắc yêu cầu.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600">
                    Bắt đầu lập đơn <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </CardContent>
              </Card>

              <Card className="border-slate-200 hover:border-blue-300 transition-colors cursor-pointer">
                <CardHeader className="pb-3">
                  <Layers className="h-6 w-6 text-blue-600 mb-1" />
                  <CardTitle className="text-base font-semibold">Theo dõi tiến độ đơn</CardTitle>
                  <CardDescription className="text-xs">
                    Kiểm tra tình trạng cắt, may, giặt hiệu ứng và kiểm hàng.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600">
                    Xem danh sách đơn <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </CardContent>
              </Card>

              <Card className="border-slate-200 hover:border-blue-300 transition-colors cursor-pointer">
                <CardHeader className="pb-3">
                  <Package className="h-6 w-6 text-blue-600 mb-1" />
                  <CardTitle className="text-base font-semibold">Đóng gói & Bàn giao</CardTitle>
                  <CardDescription className="text-xs">
                    Lập phiếu đóng gói thành phẩm và bàn giao cho khách hàng.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600">
                    Mở phiếu bàn giao <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      case Role.PROCESS_ENGINEER:
        return (
          <div className="space-y-4">
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-5">
              <h3 className="text-lg font-bold text-indigo-900">
                Bàn làm việc Kỹ thuật chuyền & Quy trình may
              </h3>
              <p className="mt-1 text-sm text-indigo-700">
                Thiết kế chuỗi công đoạn may jeans tiêu chuẩn, định mức kỹ thuật và tiêu chuẩn chất
                lượng.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="border-slate-200 hover:border-indigo-300 transition-colors cursor-pointer">
                <CardHeader className="pb-3">
                  <GitFork className="h-6 w-6 text-indigo-600 mb-1" />
                  <CardTitle className="text-base font-semibold">Quy trình may mẫu Jean</CardTitle>
                  <CardDescription className="text-xs">
                    Sắp xếp thứ tự các công đoạn cắt, may ráp, giặt và hoàn thiện.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600">
                    Thiết kế quy trình <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </CardContent>
              </Card>

              <Link to="/catalog" className="block">
                <Card className="h-full border-slate-200 hover:border-indigo-300 hover:shadow-sm transition-all cursor-pointer">
                  <CardHeader className="pb-3">
                    <FileSpreadsheet className="h-6 w-6 text-indigo-600 mb-1" />
                    <CardTitle className="text-base font-semibold">Ma trận vải & Màu sắc</CardTitle>
                    <CardDescription className="text-xs">
                      Quy định loại vải nào được phép áp dụng màu nhuộm cụ thể.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600">
                      Cập nhật ma trận <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </CardContent>
                </Card>
              </Link>

              <Link to="/catalog" className="block">
                <Card className="h-full border-slate-200 hover:border-indigo-300 hover:shadow-sm transition-all cursor-pointer">
                  <CardHeader className="pb-3">
                    <ShieldCheck className="h-6 w-6 text-indigo-600 mb-1" />
                    <CardTitle className="text-base font-semibold">Tiêu chuẩn kiểm định</CardTitle>
                    <CardDescription className="text-xs">
                      Cấu hình độ co giãn tối đa và mức phai màu cho phép khi giặt.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600">
                      Xem hồ sơ tiêu chuẩn <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </CardContent>
                </Card>
              </Link>
            </div>
          </div>
        );

      case Role.QC_INSPECTOR:
        return (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-5">
              <h3 className="text-lg font-bold text-emerald-900">
                Bàn làm việc Kiểm tra chất lượng (QC)
              </h3>
              <p className="mt-1 text-sm text-emerald-700">
                Kiểm định chất lượng sản phẩm từng công đoạn, ghi nhận lỗi và quyết định duyệt đạt
                hay sửa lại.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="border-slate-200 hover:border-emerald-300 transition-colors cursor-pointer">
                <CardHeader className="pb-3">
                  <FileCheck className="h-6 w-6 text-emerald-600 mb-1" />
                  <CardTitle className="text-base font-semibold">Lô hàng chờ kiểm tra</CardTitle>
                  <CardDescription className="text-xs">
                    Danh sách các lô thành phẩm may và giặt đang chờ nghiệm thu.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                    Bắt đầu kiểm hàng <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </CardContent>
              </Card>

              <Card className="border-slate-200 hover:border-emerald-300 transition-colors cursor-pointer">
                <CardHeader className="pb-3">
                  <ShieldCheck className="h-6 w-6 text-emerald-600 mb-1" />
                  <CardTitle className="text-base font-semibold">Biên bản nghiệm thu</CardTitle>
                  <CardDescription className="text-xs">
                    Đo độ co giãn thực tế, kiểm tra độ bền màu và đường chỉ may.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                    Lập biên bản <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </CardContent>
              </Card>

              <Card className="border-slate-200 hover:border-emerald-300 transition-colors cursor-pointer">
                <CardHeader className="pb-3">
                  <Factory className="h-6 w-6 text-emerald-600 mb-1" />
                  <CardTitle className="text-base font-semibold">Chuyển sửa lại (Rework)</CardTitle>
                  <CardDescription className="text-xs">
                    Chỉ định công đoạn cần sửa lỗi và ghi chú lý do không đạt.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                    Tạo phiếu sửa hàng <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      case Role.STATION_OPERATOR:
        return (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-5">
              <h3 className="text-lg font-bold text-amber-900">Bàn làm việc Công nhân công đoạn</h3>
              <p className="mt-1 text-sm text-amber-700">
                Ghi nhận số lượng may cắt hoàn thành trong ca và báo cáo sự cố tại trạm làm việc.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="border-slate-200 hover:border-amber-300 transition-colors cursor-pointer">
                <CardHeader className="pb-3">
                  <Scissors className="h-6 w-6 text-amber-600 mb-1" />
                  <CardTitle className="text-base font-semibold">
                    Nhập sản lượng hoàn thành
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Ghi nhận số lượng sản phẩm may đạt tiêu chuẩn trong ca.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                    Ghi nhận số lượng <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </CardContent>
              </Card>

              <Card className="border-slate-200 hover:border-amber-300 transition-colors cursor-pointer">
                <CardHeader className="pb-3">
                  <Factory className="h-6 w-6 text-amber-600 mb-1" />
                  <CardTitle className="text-base font-semibold">
                    Báo cáo hàng lỗi / Phế phẩm
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Ghi nhận số lượng rách vải, may lệch hoặc đứt chỉ phát sinh.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                    Báo cáo lỗi <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </CardContent>
              </Card>

              <Card className="border-slate-200 hover:border-amber-300 transition-colors cursor-pointer">
                <CardHeader className="pb-3">
                  <ClipboardList className="h-6 w-6 text-amber-600 mb-1" />
                  <CardTitle className="text-base font-semibold">
                    Công việc được giao ca này
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Xem chỉ tiêu số lượng và lệnh cắt may cần hoàn thành trong ngày.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                    Xem danh sách việc <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      case Role.WAREHOUSE_KEEPER:
        return (
          <div className="space-y-4">
            <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-5">
              <h3 className="text-lg font-bold text-teal-900">
                Bàn làm việc Quản lý kho nguyên phụ liệu
              </h3>
              <p className="mt-1 text-sm text-teal-700">
                Theo dõi cây vải tồn kho, cấp phát nguyên phụ liệu cho lệnh cắt và kiểm soát hao
                hụt.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="border-slate-200 hover:border-teal-300 transition-colors cursor-pointer">
                <CardHeader className="pb-3">
                  <Package className="h-6 w-6 text-teal-600 mb-1" />
                  <CardTitle className="text-base font-semibold">Kho cây vải & Lot hàng</CardTitle>
                  <CardDescription className="text-xs">
                    Kiểm tra số mét vải thực tế khả dụng của từng kiện vải.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-teal-600">
                    Xem tồn kho vải <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </CardContent>
              </Card>

              <Card className="border-slate-200 hover:border-teal-300 transition-colors cursor-pointer">
                <CardHeader className="pb-3">
                  <Layers className="h-6 w-6 text-teal-600 mb-1" />
                  <CardTitle className="text-base font-semibold">Xuất vải cho lệnh cắt</CardTitle>
                  <CardDescription className="text-xs">
                    Phân bổ mét vải cho tổ cắt may theo định mức đơn hàng.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-teal-600">
                    Tạo phiếu xuất vải <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </CardContent>
              </Card>

              <Card className="border-slate-200 hover:border-teal-300 transition-colors cursor-pointer">
                <CardHeader className="pb-3">
                  <ClipboardList className="h-6 w-6 text-teal-600 mb-1" />
                  <CardTitle className="text-base font-semibold">
                    Cảnh báo thiếu hụt vật tư
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Đề xuất mua thêm chỉ may, nút kim loại, nhãn mác cho xưởng.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-teal-600">
                    Đề xuất vật tư <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      case Role.MANAGER:
        return (
          <div className="space-y-4">
            <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-5">
              <h3 className="text-lg font-bold text-purple-900">
                Bàn làm việc Quản lý điều hành phân xưởng
              </h3>
              <p className="mt-1 text-sm text-purple-700">
                Theo dõi tổng quan tiến độ các chuyền, tỷ lệ hoàn thành đơn hàng và báo cáo chất
                lượng toàn xưởng.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="border-slate-200 hover:border-purple-300 transition-colors cursor-pointer">
                <CardHeader className="pb-3">
                  <TrendingUp className="h-6 w-6 text-purple-600 mb-1" />
                  <CardTitle className="text-base font-semibold">Tiến độ sản xuất xưởng</CardTitle>
                  <CardDescription className="text-xs">
                    Tổng hợp số lượng sản phẩm đang cắt, đang may và chờ giao.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-purple-600">
                    Xem báo cáo xưởng <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </CardContent>
              </Card>

              <Card className="border-slate-200 hover:border-purple-300 transition-colors cursor-pointer">
                <CardHeader className="pb-3">
                  <ShieldCheck className="h-6 w-6 text-purple-600 mb-1" />
                  <CardTitle className="text-base font-semibold">Chỉ số chất lượng & Lỗi</CardTitle>
                  <CardDescription className="text-xs">
                    Thống kê tỷ lệ sản phẩm phải sửa lại tại các chuyền may và giặt.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-purple-600">
                    Phân tích chất lượng <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </CardContent>
              </Card>

              <Card className="border-slate-200 hover:border-purple-300 transition-colors cursor-pointer">
                <CardHeader className="pb-3">
                  <History className="h-6 w-6 text-purple-600 mb-1" />
                  <CardTitle className="text-base font-semibold">Nhật ký vận hành</CardTitle>
                  <CardDescription className="text-xs">
                    Theo dõi lịch sử xác nhận đơn, xuất kho và phê duyệt kỹ thuật.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-purple-600">
                    Tra cứu lịch sử <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      case Role.ADMIN:
      default:
        return (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-100/60 p-5">
              <h3 className="text-lg font-bold text-slate-900">
                Bàn làm việc Quản trị viên hệ thống
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Quản lý danh sách nhân sự, phân quyền vị trí làm việc và quản trị danh mục dữ liệu
                xưởng.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Link to="/users" className="block">
                <Card className="h-full border-slate-200 hover:border-slate-400 hover:shadow-sm transition-all cursor-pointer">
                  <CardHeader className="pb-3">
                    <Users className="h-6 w-6 text-slate-700 mb-1" />
                    <CardTitle className="text-base font-semibold">
                      Tài khoản & Phân quyền
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Cấp tài khoản nhân viên, phân công bộ phận và mở khóa tài khoản.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-800">
                      Quản lý tài khoản <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </CardContent>
                </Card>
              </Link>

              <Link to="/catalog" className="block">
                <Card className="h-full border-slate-200 hover:border-slate-400 hover:shadow-sm transition-all cursor-pointer">
                  <CardHeader className="pb-3">
                    <FileSpreadsheet className="h-6 w-6 text-slate-700 mb-1" />
                    <CardTitle className="text-base font-semibold">Danh mục xưởng may</CardTitle>
                    <CardDescription className="text-xs">
                      Quản lý danh mục loại vải, màu nhuộm, kiểu giặt và trạm sản xuất.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-800">
                      Mở danh mục <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </CardContent>
                </Card>
              </Link>

              <Card className="border-slate-200 hover:border-slate-400 transition-colors cursor-pointer">
                <CardHeader className="pb-3">
                  <History className="h-6 w-6 text-slate-700 mb-1" />
                  <CardTitle className="text-base font-semibold">Nhật ký hệ thống</CardTitle>
                  <CardDescription className="text-xs">
                    Kiểm tra toàn bộ lịch sử các thao tác thay đổi dữ liệu trong phân xưởng.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-800">
                    Xem nhật ký <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </CardContent>
              </Card>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Dynamic Role Workspace Section */}
      {renderRoleWorkspace()}

      {/* Account Info and System Health Status */}
      <div className="grid gap-6 md:grid-cols-2 pt-2">
        {/* Thông tin nhân viên */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-base font-semibold">Thông tin nhân viên</CardTitle>
            </div>
            <CardDescription>Chi tiết tài khoản đang làm việc</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            <div>
              <label className="text-xs font-medium text-slate-500">Họ và tên</label>
              <div className="text-sm font-semibold text-slate-900">{user?.fullName}</div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Email làm việc</label>
              <div className="text-sm font-semibold text-slate-900">{user?.email}</div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Vị trí công tác</label>
              <div className="mt-1">
                <Badge tone="info" className="font-medium">
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
    </div>
  );
};
