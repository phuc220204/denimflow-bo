import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { fetchDashboardWipApi } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#94A3B8',
  CONFIRMED: '#38BDF8',
  IN_PRODUCTION: '#2F5D8A',
  ON_HOLD: '#F59E0B',
  COMPLETED: '#2E7D5B',
  CANCELLED: '#EF4444',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Bản nháp',
  CONFIRMED: 'Đã xác nhận',
  IN_PRODUCTION: 'Đang sản xuất',
  ON_HOLD: 'Tạm dừng',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
};

export const WipDashboard: React.FC = () => {
  const { token } = useAuth();

  const {
    data: wip,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ['dashboard', 'wip'],
    queryFn: () => fetchDashboardWipApi(token),
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <Card className="border-border bg-surface p-8 text-center">
        <div className="flex flex-col items-center justify-center gap-3">
          <RefreshCw className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-text-muted">Đang tải dữ liệu điều hành WIP phân xưởng...</p>
        </div>
      </Card>
    );
  }

  if (error || !wip) {
    return (
      <Card className="border-danger/30 bg-danger-tint/20 p-6 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-danger" />
        <h3 className="mt-2 text-sm font-semibold text-danger-text">
          Không thể tải dữ liệu điều hành WIP
        </h3>
        <p className="mt-1 text-xs text-text-muted">
          {(error as Error)?.message || 'Vui lòng kiểm tra lại kết nối mạng.'}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-4">
          Thử lại
        </Button>
      </Card>
    );
  }

  // Format order status data for PieChart
  const orderStatusChartData = Object.entries(wip.ordersByStatus)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({
      name: STATUS_LABELS[status] || status,
      value: count,
      color: STATUS_COLORS[status] || '#64748B',
    }));

  return (
    <div className="space-y-6">
      {/* Header with Title and Refresh */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-text flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Bảng điều hành WIP & Sản lượng phân xưởng (FR-21)
          </h2>
          <p className="text-xs text-text-muted">
            Theo dõi tiến độ bán thành phẩm trên chuyền, kiểm soát tỷ lệ lỗi và cảnh báo nghẽn QC.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-xs gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            {isFetching ? 'Đang cập nhật...' : 'Làm mới'}
          </Button>
        </div>
      </div>

      {/* KPI Highlight Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {/* Total Orders */}
        <Card className="border-border bg-surface">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-text-muted">Đơn hàng xưởng</span>
              <Layers className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold tabular-nums text-text">
              {wip.totals.totalOrders}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-text-muted flex gap-2">
            <span className="text-primary font-medium">{wip.totals.activeOrders} đang chạy</span>
            <span>•</span>
            <span className="text-success font-medium">
              {wip.totals.completedOrders} hoàn thành
            </span>
          </CardContent>
        </Card>

        {/* Good Products */}
        <Card className="border-border bg-surface">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-text-muted">Sản lượng đạt chuẩn</span>
              <CheckCircle2 className="h-4 w-4 text-success" />
            </div>
            <CardTitle className="text-2xl font-bold tabular-nums text-success">
              {wip.totals.totalQtyGood.toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-text-muted">
            Sản phẩm jeans qua các công đoạn đạt tiêu chuẩn
          </CardContent>
        </Card>

        {/* Defects & Rework */}
        <Card className="border-border bg-surface">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-text-muted">Lỗi & Làm lại (Rework)</span>
              <RotateCcw className="h-4 w-4 text-warning" />
            </div>
            <CardTitle className="text-2xl font-bold tabular-nums text-text flex items-baseline gap-2">
              <span className="text-danger">{wip.totals.totalQtyDefect.toLocaleString()}</span>
              <span className="text-xs font-normal text-text-muted">lỗi /</span>
              <span className="text-warning text-lg">{wip.totals.totalReworkCount}</span>
              <span className="text-xs font-normal text-text-muted">lần sửa</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-text-muted">
            Ghi nhận kiểm tra phế phẩm và định tuyến sửa chuyền
          </CardContent>
        </Card>

        {/* Orders Waiting QC */}
        <Card
          className={`border-border bg-surface ${
            wip.totals.waitingQcCount > 0 ? 'border-warning/50 bg-warning-tint/10' : ''
          }`}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-text-muted">Chờ kiểm hàng (QC)</span>
              <ShieldCheck
                className={`h-4 w-4 ${
                  wip.totals.waitingQcCount > 0 ? 'text-warning' : 'text-text-muted'
                }`}
              />
            </div>
            <CardTitle className="text-2xl font-bold tabular-nums text-text flex items-center gap-2">
              <span className={wip.totals.waitingQcCount > 0 ? 'text-warning-text' : ''}>
                {wip.totals.waitingQcCount}
              </span>
              {wip.totals.waitingQcCount > 0 && (
                <Badge tone="warning" className="text-[10px] px-1.5 py-0.5">
                  Cần xử lý
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-text-muted">
            Công đoạn đang ở trạng thái WAITING_QC
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* WIP Quantity per Station / Step Bar Chart */}
        <Card className="border-border bg-surface lg:col-span-2">
          <CardHeader className="pb-2 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-text flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Sản lượng WIP theo công đoạn sản xuất
                </CardTitle>
                <CardDescription className="text-xs text-text-muted">
                  So sánh số lượng nhập chuyền, sản phẩm đạt và phế phẩm phát sinh
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {wip.wipByStation.length === 0 ? (
              <div className="py-12 text-center text-xs text-text-muted">
                Hiện chưa có công đoạn nào đang trong tiến trình gia công.
              </div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={wip.wipByStation}
                    margin={{ top: 10, right: 10, left: -10, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E5EA" vertical={false} />
                    <XAxis
                      dataKey="stepName"
                      tick={{ fontSize: 11, fill: '#5B6672' }}
                      angle={-20}
                      textAnchor="end"
                      height={40}
                    />
                    <YAxis tick={{ fontSize: 11, fill: '#5B6672' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        borderColor: '#E2E5EA',
                        borderRadius: 6,
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                    <Bar
                      dataKey="totalQtyIn"
                      fill="#2F5D8A"
                      name="Nhập vào"
                      radius={[3, 3, 0, 0]}
                    />
                    <Bar
                      dataKey="totalQtyGood"
                      fill="#2E7D5B"
                      name="Đạt chuẩn"
                      radius={[3, 3, 0, 0]}
                    />
                    <Bar dataKey="totalQtyDefect" fill="#B33A3A" name="Lỗi" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Status Distribution Donut Chart */}
        <Card className="border-border bg-surface">
          <CardHeader className="pb-2 border-b border-border">
            <CardTitle className="text-base font-semibold text-text">
              Cơ cấu trạng thái đơn hàng
            </CardTitle>
            <CardDescription className="text-xs text-text-muted">
              Phân bổ số lượng đơn hàng theo giai đoạn
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {orderStatusChartData.length === 0 ? (
              <div className="py-12 text-center text-xs text-text-muted">Chưa có đơn hàng nào.</div>
            ) : (
              <div className="h-64 w-full flex flex-col items-center justify-center">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={orderStatusChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {orderStatusChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: unknown) => [`${String(val ?? 0)} đơn`, 'Số lượng']}
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        borderColor: '#E2E5EA',
                        borderRadius: 6,
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  {orderStatusChartData.map((item) => (
                    <div key={item.name} className="flex items-center gap-1.5 text-[11px]">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-text-muted">{item.name}:</span>
                      <span className="font-semibold text-text">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Orders Waiting QC Alert Table */}
      {wip.waitingQcOrders.length > 0 && (
        <Card className="border-warning/40 bg-surface">
          <CardHeader className="pb-3 border-b border-warning/20 bg-warning-tint/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-warning" />
                <div>
                  <CardTitle className="text-base font-semibold text-text">
                    Đơn hàng đang chờ kiểm tra chất lượng (WAITING_QC)
                  </CardTitle>
                  <CardDescription className="text-xs text-text-muted">
                    Các công đoạn cần chuyên viên QC kiểm tra kích thước co rút, độ loang màu hoặc
                    chỉ tiêu ngoại quan.
                  </CardDescription>
                </div>
              </div>
              <Badge tone="warning">{wip.waitingQcOrders.length} công đoạn chờ</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-slate-50 text-text-muted font-medium">
                  <tr>
                    <th className="px-4 py-2.5">Mã đơn hàng</th>
                    <th className="px-4 py-2.5">Kiểu dáng</th>
                    <th className="px-4 py-2.5">Công đoạn</th>
                    <th className="px-4 py-2.5">Trạm</th>
                    <th className="px-4 py-2.5">Bắt đầu từ</th>
                    <th className="px-4 py-2.5 text-right">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {wip.waitingQcOrders.map((item) => (
                    <tr key={item.stepInstanceId} className="hover:bg-primary-tint/30">
                      <td className="px-4 py-3 font-mono font-semibold text-primary">
                        {item.orderNumber}
                      </td>
                      <td className="px-4 py-3 font-mono">{item.styleCode}</td>
                      <td className="px-4 py-3 font-medium text-text">
                        {item.stepName}
                        <span className="block font-mono text-[10px] text-text-muted">
                          {item.stepCode}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-muted">{item.stationType || 'N/A'}</td>
                      <td className="px-4 py-3 text-text-muted">
                        {item.startedAt ? (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(item.startedAt).toLocaleString('vi-VN')}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Badge tone="warning">WAITING_QC</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* WIP Station Detail Table */}
      <Card className="border-border bg-surface">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-base font-semibold text-text">
            Bảng theo dõi bán thành phẩm (WIP) theo từng công đoạn
          </CardTitle>
          <CardDescription className="text-xs text-text-muted">
            Chi tiết số lệnh đang xử lý, số bó bán thành phẩm và tỷ lệ đạt/hỏng
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-slate-50 text-text-muted font-medium">
                <tr>
                  <th className="px-4 py-2.5">Mã công đoạn</th>
                  <th className="px-4 py-2.5">Tên công đoạn</th>
                  <th className="px-4 py-2.5">Trạm sản xuất</th>
                  <th className="px-4 py-2.5 text-center">Số lệnh chạy</th>
                  <th className="px-4 py-2.5 text-center">Số bó vải (Bundles)</th>
                  <th className="px-4 py-2.5 text-right">SL Nhập</th>
                  <th className="px-4 py-2.5 text-right">SL Đạt</th>
                  <th className="px-4 py-2.5 text-right">SL Lỗi</th>
                  <th className="px-4 py-2.5 text-right">Tỷ lệ lỗi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {wip.wipByStation.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-text-muted">
                      Chưa có bán thành phẩm trên chuyền.
                    </td>
                  </tr>
                ) : (
                  wip.wipByStation.map((row) => {
                    const defectRate =
                      row.totalQtyIn > 0
                        ? ((row.totalQtyDefect / row.totalQtyIn) * 100).toFixed(1)
                        : '0.0';
                    return (
                      <tr key={row.stepCode} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono font-semibold text-text">
                          {row.stepCode}
                        </td>
                        <td className="px-4 py-3 font-medium text-text">{row.stepName}</td>
                        <td className="px-4 py-3">
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                            {row.stationType || 'KHÁC'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center tabular-nums font-semibold text-text">
                          {row.activeStepCount}
                        </td>
                        <td className="px-4 py-3 text-center tabular-nums text-text">
                          {row.bundleCount}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-text">
                          {row.totalQtyIn.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-success">
                          {row.totalQtyGood.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-danger">
                          {row.totalQtyDefect.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          <span
                            className={
                              Number(defectRate) > 5
                                ? 'text-danger font-semibold'
                                : 'text-text-muted'
                            }
                          >
                            {defectRate}%
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
