import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye, History, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { AuditLogItemDto, fetchAuditLogsApi } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';

const ENTITY_TYPE_OPTIONS = [
  { value: '', label: 'Tất cả đối tượng' },
  { value: 'production_order', label: 'Đơn hàng (production_order)' },
  { value: 'workflow_instance', label: 'Tiến trình quy trình (workflow_instance)' },
  { value: 'step_instance', label: 'Công đoạn thực thi (step_instance)' },
  { value: 'step_quantity_entry', label: 'Sản lượng công đoạn (step_quantity_entry)' },
  { value: 'qc_inspection', label: 'Biên bản kiểm tra QC (qc_inspection)' },
  { value: 'material_allocation', label: 'Phân bổ vật tư (material_allocation)' },
  { value: 'handover_record', label: 'Biên bản bàn giao (handover_record)' },
  { value: 'profile', label: 'Tài khoản nhân sự (profile)' },
];

export const AuditPage: React.FC = () => {
  const { token } = useAuth();

  // Filters state
  const [entityType, setEntityType] = useState('');
  const [entityId, setEntityId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const limit = 15;

  // Selected item for modal
  const [selectedLog, setSelectedLog] = useState<AuditLogItemDto | null>(null);

  const queryParams = {
    entityType: entityType || undefined,
    entityId: entityId || undefined,
    from: from ? new Date(from).toISOString() : undefined,
    to: to ? new Date(to).toISOString() : undefined,
    page,
    limit,
  };

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['audit-logs', queryParams],
    queryFn: () => fetchAuditLogsApi(queryParams, token),
  });

  const handleResetFilters = () => {
    setEntityType('');
    setEntityId('');
    setFrom('');
    setTo('');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-text flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Nhật ký kiểm toán hệ thống (FR-25, BR-16)
          </h2>
          <p className="text-xs text-text-muted">
            Truy vết mọi thay đổi dữ liệu đơn hàng, sản lượng, kiểm tra chất lượng và phân quyền
            (bất biến, chỉ ghi thêm).
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
            {isFetching ? 'Đang tải...' : 'Làm mới'}
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <Card className="border-border bg-surface p-4">
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
          {/* Entity Type Filter */}
          <div>
            <label className="text-xs font-medium text-text-muted mb-1 block">Loại đối tượng</label>
            <select
              value={entityType}
              onChange={(e) => {
                setEntityType(e.target.value);
                setPage(1);
              }}
              className="w-full h-9 rounded border border-border bg-surface px-2.5 text-xs text-text focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {ENTITY_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Entity UUID Filter */}
          <div>
            <label className="text-xs font-medium text-text-muted mb-1 block">
              Mã UUID đối tượng
            </label>
            <Input
              placeholder="VD: 550e8400-e29b-..."
              value={entityId}
              onChange={(e) => {
                setEntityId(e.target.value);
                setPage(1);
              }}
              className="h-9 text-xs font-mono"
            />
          </div>

          {/* From Date */}
          <div>
            <label className="text-xs font-medium text-text-muted mb-1 block">Từ ngày</label>
            <Input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
              className="h-9 text-xs"
            />
          </div>

          {/* To Date */}
          <div>
            <label className="text-xs font-medium text-text-muted mb-1 block">Đến ngày</label>
            <Input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
              className="h-9 text-xs"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              className="h-9 text-xs w-full"
            >
              Đặt lại bộ lọc
            </Button>
          </div>
        </div>
      </Card>

      {/* Audit Log Table */}
      <Card className="border-border bg-surface">
        <CardHeader className="pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-text">
                Danh sách bản ghi kiểm toán ({data?.total ?? 0})
              </CardTitle>
              <CardDescription className="text-xs text-text-muted">
                Bảo đảm tính toàn vẹn và minh bạch theo tiêu chuẩn kiến trúc xưởng
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-slate-50 text-text-muted font-medium">
                <tr>
                  <th className="px-4 py-2.5">Thời gian</th>
                  <th className="px-4 py-2.5">Tác nhân</th>
                  <th className="px-4 py-2.5">Thao tác</th>
                  <th className="px-4 py-2.5">Loại đối tượng</th>
                  <th className="px-4 py-2.5">Mã đối tượng (UUID)</th>
                  <th className="px-4 py-2.5 text-right">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                      Đang tải danh sách nhật ký...
                    </td>
                  </tr>
                ) : !data || data.items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                      Không có bản ghi nhật ký kiểm toán nào phù hợp với bộ lọc.
                    </td>
                  </tr>
                ) : (
                  data.items.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-text-muted whitespace-nowrap font-mono">
                        {new Date(log.createdAt).toLocaleString('vi-VN')}
                      </td>
                      <td className="px-4 py-3">
                        {log.actorName ? (
                          <div>
                            <span className="font-semibold text-text block">{log.actorName}</span>
                            <span className="text-[11px] text-text-muted block">
                              {log.actorEmail}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                            <ShieldCheck className="h-3 w-3 text-slate-500" />
                            Hệ thống tự động
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded bg-primary-tint px-2 py-0.5 font-mono text-[11px] font-semibold text-primary">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-text-muted">{log.entityType}</td>
                      <td className="px-4 py-3 font-mono text-text-muted text-[11px]">
                        {log.entityId}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedLog(log)}
                          className="h-7 text-[11px] gap-1 px-2"
                        >
                          <Eye className="h-3.5 w-3.5 text-primary" />
                          Xem thay đổi
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination controls */}
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <span className="text-xs text-text-muted">
                Trang <span className="font-semibold text-text">{data.page}</span> /{' '}
                <span className="font-semibold text-text">{data.totalPages}</span> (Tổng{' '}
                {data.total} bản ghi)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  disabled={data.page <= 1}
                  className="h-8 text-xs"
                >
                  Trang trước
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(p + 1, data.totalPages))}
                  disabled={data.page >= data.totalPages}
                  className="h-8 text-xs"
                >
                  Trang sau
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Changes Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-lg border border-border bg-surface p-6 shadow-xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-semibold text-text flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" />
                  Chi tiết bản ghi kiểm toán #{selectedLog.id}
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Thao tác:{' '}
                  <span className="font-mono font-semibold text-primary">{selectedLog.action}</span>{' '}
                  • Đối tượng: <span className="font-mono">{selectedLog.entityType}</span>
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedLog(null)}
                className="h-7 w-7 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4 overflow-y-auto pr-1 flex-1 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-medium text-text-muted block">Thời điểm thực hiện:</span>
                  <span className="font-mono text-text">
                    {new Date(selectedLog.createdAt).toLocaleString('vi-VN')}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-text-muted block">Tác nhân thao tác:</span>
                  <span className="text-text">
                    {selectedLog.actorName
                      ? `${selectedLog.actorName} (${selectedLog.actorEmail})`
                      : 'Hệ thống tự động'}
                  </span>
                </div>
              </div>

              <div>
                <span className="font-medium text-text-muted block">Mã đối tượng (UUID):</span>
                <span className="font-mono text-text">{selectedLog.entityId}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div>
                  <span className="font-semibold text-text block mb-1">
                    Dữ liệu trước thay đổi (old_value):
                  </span>
                  <pre className="p-3 bg-slate-50 border border-border rounded text-[11px] font-mono overflow-x-auto text-text max-h-56">
                    {selectedLog.oldValue
                      ? JSON.stringify(selectedLog.oldValue, null, 2)
                      : 'null (Khởi tạo mới)'}
                  </pre>
                </div>
                <div>
                  <span className="font-semibold text-text block mb-1">
                    Dữ liệu sau thay đổi (new_value):
                  </span>
                  <pre className="p-3 bg-slate-50 border border-border rounded text-[11px] font-mono overflow-x-auto text-text max-h-56">
                    {selectedLog.newValue
                      ? JSON.stringify(selectedLog.newValue, null, 2)
                      : 'null (Xóa dữ liệu)'}
                  </pre>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => setSelectedLog(null)}>
                Đóng
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
