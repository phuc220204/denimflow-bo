import { Role } from '@denimflow/shared';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Database,
  Factory,
  GitFork,
  Package,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { fetchHealth } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { i18n } from '../lib/i18n/dictionary';

// Standard 8 Key Stages in Jeans Production
const PIPELINE_STEPS = [
  { code: 'ORD', label: 'Tiếp nhận đơn', status: 'done' as const },
  { code: 'MAT', label: 'Vải & Vật tư', status: 'done' as const },
  { code: 'CUT', label: 'Cắt bán thành phẩm', status: 'current' as const },
  { code: 'SEW', label: 'May ráp cụm', status: 'pending' as const },
  { code: 'EMB', label: 'Thêu / In ấn', status: 'pending' as const },
  { code: 'WSH', label: 'Giặt hiệu ứng', status: 'pending' as const },
  { code: 'QC', label: 'Kiểm định QC', status: 'pending' as const },
  { code: 'PCK', label: 'Đóng gói & Bàn giao', status: 'pending' as const },
];

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

  const roleLabel = user ? i18n.roles[user.role] || user.role : '';

  const getRoleActions = (role: Role) => {
    switch (role) {
      case Role.PRODUCTION_PLANNER:
        return [
          {
            title: 'Tạo đơn gia công mới',
            desc: 'Chọn mã hàng, dải size & ma trận vải màu (FR-07, FR-08)',
            icon: ClipboardList,
          },
          {
            title: 'Phân bổ vật tư & BOM',
            desc: 'Tính toán định mức tiêu hao nguyên phụ liệu (FR-09, BR-06)',
            icon: Package,
          },
          {
            title: 'Duyệt mẫu Pre-Production (PP)',
            desc: 'Xác nhận thông số kỹ thuật trước khi cắt hàng loạt',
            icon: CheckCircle2,
          },
        ];
      case Role.PROCESS_ENGINEER:
        return [
          {
            title: 'Thiết kế quy trình Jean',
            desc: 'Cấu hình đồ thị các công đoạn & điểm rẽ nhánh (FR-04)',
            icon: GitFork,
          },
          {
            title: 'Quản lý phiên bản Template',
            desc: 'Kiểm duyệt và xuất bản mẫu quy trình chính thức (BR-01, BR-02)',
            icon: Sparkles,
          },
          {
            title: 'Cấu hình điều kiện rẽ nhánh (Strategy)',
            desc: 'Kiểm tra quy tắc bỏ giặt sạch, may phối (BR-18, BR-19)',
            icon: ShieldCheck,
          },
        ];
      case Role.QC_INSPECTOR:
        return [
          {
            title: 'Nghiệm thu trạm hoàn thiện',
            desc: 'Thẩm định chất lượng đường may, form dáng & độ bền màu (FR-16)',
            icon: CheckCircle2,
          },
          {
            title: 'Lập phiếu yêu cầu làm lại (Rework)',
            desc: 'Ghi nhận vị trí lỗi, kiểm soát số vòng làm lại (BR-10, BR-11)',
            icon: RefreshCw,
          },
          {
            title: 'Hồ sơ QC Profile',
            desc: 'Đối chiếu ngưỡng dung sai theo mẫu khách hàng cam kết',
            icon: ShieldCheck,
          },
        ];
      case Role.STATION_OPERATOR:
        return [
          {
            title: 'Danh sách việc của trạm (Worklist)',
            desc: 'Tiếp nhận bó bán thành phẩm từ công đoạn trước (FR-12)',
            icon: Factory,
          },
          {
            title: 'Ghi nhận số lượng đạt & phế phẩm',
            desc: 'Bảo toàn số lượng đầu vào/đầu ra theo quy tắc BR-08',
            icon: Activity,
          },
          {
            title: 'Cập nhật hoàn thành công đoạn',
            desc: 'Xác thực Gatekeeper để chuyển bó sang trạm kế tiếp (BR-14)',
            icon: ArrowRight,
          },
        ];
      case Role.WAREHOUSE_KEEPER:
        return [
          {
            title: 'Kiểm định vải đầu vào',
            desc: 'Đo độ co giãn, kiểm tra lô vải mộc & denim wash',
            icon: Package,
          },
          {
            title: 'Xuất cấp nguyên phụ liệu',
            desc: 'Cấp phát chỉ may, nút, rivet và nhãn mác theo BOM đơn',
            icon: ClipboardList,
          },
          {
            title: 'Nhập kho thành phẩm',
            desc: 'Tiếp nhận lô hàng đạt chuẩn từ trạm đóng gói (FR-26)',
            icon: CheckCircle2,
          },
        ];
      case Role.MANAGER:
        return [
          {
            title: 'Giám sát tiến độ WIP toàn xưởng',
            desc: 'Theo dõi số lượng hàng đang chạy tại từng công đoạn (FR-21)',
            icon: BarChart3,
          },
          {
            title: 'Phân tích điểm nghẽn & tồn đọng',
            desc: 'Cảnh báo trạm chậm tiến độ hoặc tỷ lệ lỗi tăng cao',
            icon: Activity,
          },
          {
            title: 'Xem báo cáo bàn giao khách hàng',
            desc: 'Thống kê sản lượng hoàn tất theo từng hợp đồng gia công',
            icon: ClipboardList,
          },
        ];
      case Role.ADMIN:
      default:
        return [
          {
            title: 'Quản trị phân quyền người dùng',
            desc: 'Cấp phát tài khoản và vai trò nhân sự xưởng (FR-01)',
            icon: UserCheck,
          },
          {
            title: 'Cấu hình danh mục nền tảng',
            desc: 'Quản lý danh sách vải, màu sắc, máy móc và xưởng con (FR-02)',
            icon: Database,
          },
          {
            title: 'Nhật ký kiểm toán hệ thống (AuditLog)',
            desc: 'Truy vết toàn diện mọi giao dịch thay đổi dữ liệu (BR-16)',
            icon: Server,
          },
        ];
    }
  };

  const actions = user ? getRoleActions(user.role) : [];

  return (
    <div className="space-y-6">
      {/* Shift & Role Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-5 rounded border border-border bg-surface">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded bg-primary-tint text-primary flex items-center justify-center font-bold text-lg shrink-0">
            <Factory className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-text">{roleLabel} — Bàn Điều Hành Trực Tiếp</h1>
              <Badge tone="primary" className="text-xs">
                Ca hiện tại
              </Badge>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Phụ trách: <span className="font-semibold text-text">{user?.fullName}</span> &bull;
              Trạng thái: <span className="text-success-text font-medium">Sẵn sàng nhận lệnh</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="text-xs gap-1.5"
          >
            <span>Đổi vị trí trực</span>
          </Button>
        </div>
      </div>

      {/* System Telemetry & Gate Status */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* API Telemetry */}
        <div className="p-3.5 rounded border border-border bg-surface flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">Dịch vụ API</span>
            <Server className="h-4 w-4 text-text-muted" />
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            {isHealthLoading ? (
              <span className="text-xs text-text-muted">Đang kiểm tra...</span>
            ) : health?.status === 'ok' ? (
              <>
                <span className="h-2 w-2 rounded-full bg-success" />
                <span className="text-xs font-semibold text-text">Sẵn sàng (200)</span>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-danger" />
                <span className="text-xs font-semibold text-danger-text">Mất tín hiệu</span>
              </>
            )}
          </div>
        </div>

        {/* Database Telemetry */}
        <div className="p-3.5 rounded border border-border bg-surface flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">Cơ sở dữ liệu</span>
            <Database className="h-4 w-4 text-text-muted" />
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            {isHealthLoading ? (
              <span className="text-xs text-text-muted">Đang kết nối...</span>
            ) : health?.db === 'up' ? (
              <>
                <span className="h-2 w-2 rounded-full bg-success" />
                <span className="text-xs font-semibold text-text">Postgres (UP)</span>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-danger" />
                <span className="text-xs font-semibold text-danger-text">Mất kết nối</span>
              </>
            )}
          </div>
        </div>

        {/* Dynamic Workflow Engine */}
        <div className="p-3.5 rounded border border-border bg-surface flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">Workflow Engine</span>
            <GitFork className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-success" />
            <span className="text-xs font-semibold text-text">Jean Standard V1</span>
          </div>
        </div>

        {/* Gate Conservation Rule */}
        <div className="p-3.5 rounded border border-border bg-surface flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">Bảo toàn số lượng</span>
            <ShieldCheck className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <Badge tone="info" className="text-[10px] px-1.5 py-0 font-mono">
              BR-08 KÍCH HOẠT
            </Badge>
          </div>
        </div>
      </div>

      {/* Production Pipeline Overview (Industrial Stepper) */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <CardTitle className="text-sm font-semibold">
                Chuỗi Công Đoạn Mẫu Jean Tiêu Chuẩn (Jean Standard Flow)
              </CardTitle>
              <CardDescription className="text-xs">
                Mô hình quy trình động gồm 8 chặng chính được bảo vệ bởi Gatekeeper và QC Checkpoint
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetchHealth()}
              disabled={isHealthFetching}
              className="h-7 text-xs gap-1"
            >
              <RefreshCw className={`h-3 w-3 ${isHealthFetching ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Cập nhật</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Stepper Track */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 pt-1">
            {PIPELINE_STEPS.map((step, idx) => (
              <div
                key={step.code}
                className={`p-3 rounded border text-left transition-all ${
                  step.status === 'done'
                    ? 'border-success/30 bg-success-tint/30 text-success-text'
                    : step.status === 'current'
                      ? 'border-primary bg-primary-tint text-primary ring-1 ring-primary'
                      : 'border-border bg-background text-text-muted opacity-75'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-mono font-bold">
                  <span>0{idx + 1}</span>
                  <span>{step.code}</span>
                </div>
                <span className="text-xs font-semibold block mt-1.5 leading-snug">
                  {step.label}
                </span>
                <span className="text-[10px] mt-1 block opacity-80">
                  {step.status === 'done'
                    ? '✓ Đã nghiệm thu'
                    : step.status === 'current'
                      ? 'Đang thực hiện'
                      : 'Chờ chuyển bước'}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Role-Specific Work Actions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-text">Nhiệm vụ trọng tâm của {roleLabel}</h2>
            <p className="text-xs text-text-muted">
              Các luồng xử lý chính được phân quyền cho vị trí này trong ca trực
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {actions.map((act) => {
            const Icon = act.icon;
            return (
              <div
                key={act.title}
                className="group p-4 rounded border border-border bg-surface hover:border-primary hover:bg-primary-tint/10 transition-all flex flex-col justify-between"
              >
                <div className="space-y-2.5">
                  <div className="h-8 w-8 rounded bg-primary-tint text-primary flex items-center justify-center transition-colors group-hover:bg-primary group-hover:text-white">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-text block group-hover:text-primary">
                      {act.title}
                    </span>
                    <p className="text-xs text-text-muted mt-1 leading-relaxed">{act.desc}</p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-primary font-medium">
                  <span>Mở bảng tác vụ</span>
                  <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
