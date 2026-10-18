import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Clock, Filter, Play, RefreshCw } from 'lucide-react';
import React, { useState } from 'react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { completeStepApi, fetchWorklistApi, startStepApi } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import type { StepStatus, WorklistItemDto } from '@denimflow/shared';

const STATUS_CONFIG: Record<
  string,
  { label: string; tone: 'outline' | 'info' | 'primary' | 'success' | 'warning' | 'danger' }
> = {
  READY: { label: 'Sẵn sàng', tone: 'info' },
  IN_PROGRESS: { label: 'Đang thực hiện', tone: 'primary' },
  REWORK: { label: 'Cần làm lại', tone: 'danger' },
  WAITING_QC: { label: 'Chờ kiểm tra QC', tone: 'warning' },
};

export const WorklistPage: React.FC = () => {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [stationFilter, setStationFilter] = useState<string>('ALL');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const {
    data: worklist = [],
    isLoading,
    isRefetching,
    refetch,
    error: loadError,
  } = useQuery({
    queryKey: ['worklist', statusFilter, stationFilter],
    queryFn: () =>
      fetchWorklistApi(token, {
        status: statusFilter !== 'ALL' ? (statusFilter as StepStatus) : undefined,
        stationType: stationFilter !== 'ALL' ? stationFilter : undefined,
      }),
  });

  const startMutation = useMutation({
    mutationFn: (stepId: string) => startStepApi(stepId, token),
    onSuccess: () => {
      setActionSuccess('Đã bắt đầu công đoạn thành công!');
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ['worklist'] });
    },
    onError: (err: Error) => {
      setActionError(err.message || 'Không thể bắt đầu công đoạn');
      setActionSuccess(null);
    },
  });

  const completeMutation = useMutation({
    mutationFn: (stepId: string) => completeStepApi(stepId, token),
    onSuccess: (data) => {
      let msg = 'Đã xác nhận hoàn thành công đoạn!';
      if (data.newlyReadyStepCodes.length > 0) {
        msg += ` Công đoạn tiếp theo [${data.newlyReadyStepCodes.join(', ')}] đã sẵn sàng.`;
      }
      if (data.newlySkippedStepCodes.length > 0) {
        msg += ` Công đoạn [${data.newlySkippedStepCodes.join(', ')}] được tự động bỏ qua.`;
      }
      setActionSuccess(msg);
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ['worklist'] });
    },
    onError: (err: Error) => {
      setActionError(err.message || 'Không thể hoàn thành công đoạn');
      setActionSuccess(null);
    },
  });

  const handleStart = (stepId: string) => {
    setActionError(null);
    setActionSuccess(null);
    startMutation.mutate(stepId);
  };

  const handleComplete = (stepId: string) => {
    setActionError(null);
    setActionSuccess(null);
    completeMutation.mutate(stepId);
  };

  const isOperator = user?.role === 'STATION_OPERATOR';

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">Danh sách công việc trạm</h1>
          <p className="text-sm text-text-muted mt-1">
            Quản lý các công đoạn sản xuất, bắt đầu thao tác và ghi nhận hoàn thành theo quy trình
            (FR-12).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading || isRefetching}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
            Làm mới
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-sm">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {loadError && (
        <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-sm">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
          <span>Lỗi tải danh sách công việc: {(loadError as Error).message}</span>
        </div>
      )}

      {/* Filter Toolbar (for Planners/Managers/Admins) */}
      {!isOperator && (
        <div className="flex flex-wrap items-center gap-3 bg-surface p-3 rounded-lg border border-border">
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <Filter className="h-4 w-4" />
            <span>Bộ lọc:</span>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-border rounded px-2.5 py-1 text-sm bg-background"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="READY">Sẵn sàng (READY)</option>
            <option value="IN_PROGRESS">Đang làm (IN_PROGRESS)</option>
            <option value="REWORK">Làm lại (REWORK)</option>
            <option value="WAITING_QC">Chờ QC (WAITING_QC)</option>
          </select>

          <select
            value={stationFilter}
            onChange={(e) => setStationFilter(e.target.value)}
            className="border border-border rounded px-2.5 py-1 text-sm bg-background"
          >
            <option value="ALL">Tất cả trạm sản xuất</option>
            <option value="CUTTING">Trạm Cắt (CUTTING)</option>
            <option value="SEWING">Trạm May (SEWING)</option>
            <option value="EMBROIDERY">Trạm Thêu (EMBROIDERY)</option>
            <option value="DYEING">Trạm Nhuộm (DYEING)</option>
            <option value="WASH">Trạm Giặt/Wash (WASH)</option>
            <option value="FINISHING">Trạm Hoàn thiện (FINISHING)</option>
            <option value="QC">Trạm QC</option>
          </select>
        </div>
      )}

      {/* Worklist Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <div className="flex flex-col items-center gap-2">
            <RefreshCw className="h-6 w-6 animate-spin text-primary" />
            <span className="text-sm text-text-muted">Đang tải danh sách công việc...</span>
          </div>
        </div>
      ) : worklist.length === 0 ? (
        <Card className="text-center p-8 border-dashed">
          <CardHeader>
            <CardTitle className="text-lg">Hiện không có công việc nào</CardTitle>
            <CardDescription>
              Không có công đoạn nào ở trạng thái sẵn sàng hoặc đang thực hiện cho trạm của bạn.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {worklist.map((item: WorklistItemDto) => {
            const config = STATUS_CONFIG[item.status] || {
              label: item.status,
              tone: 'outline' as const,
            };

            const isPendingAction = startMutation.isPending || completeMutation.isPending;

            return (
              <Card
                key={item.id}
                className="flex flex-col justify-between border border-border shadow-sm hover:shadow transition-shadow"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground uppercase">
                        {item.stationType || item.responsibleRole}
                      </span>
                      <CardTitle className="text-base font-semibold mt-1">
                        {item.stepName} ({item.stepCode})
                      </CardTitle>
                    </div>
                    <Badge tone={config.tone}>{config.label}</Badge>
                  </div>
                  <CardDescription className="text-xs">
                    Đơn hàng: <span className="font-medium text-text">{item.orderNumber}</span>
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-3 pb-4 text-xs text-text-muted">
                  <div className="grid grid-cols-2 gap-2 bg-muted/40 p-2.5 rounded-lg">
                    <div>
                      <span className="block text-text-muted">Mã Style:</span>
                      <span className="font-semibold text-text">{item.styleCode}</span>
                    </div>
                    <div>
                      <span className="block text-text-muted">Tổng số lượng:</span>
                      <span className="font-semibold text-text">{item.totalPlannedQty} cái</span>
                    </div>
                  </div>

                  {item.startedAt && (
                    <div className="flex items-center gap-1.5 text-text-muted">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Bắt đầu: {new Date(item.startedAt).toLocaleTimeString('vi-VN')}</span>
                    </div>
                  )}

                  {item.requiresEvidence && (
                    <div className="text-[11px] text-amber-700 bg-amber-50 px-2 py-1 rounded">
                      Yêu cầu đính kèm minh chứng trước khi hoàn thành (BR-15).
                    </div>
                  )}

                  {item.requiresQc && (
                    <div className="text-[11px] text-purple-700 bg-purple-50 px-2 py-1 rounded">
                      Sau khi hoàn thành sẽ chuyển sang trạng thái Chờ kiểm tra QC (BR-19).
                    </div>
                  )}

                  {/* Actions */}
                  <div className="pt-2">
                    {(item.status === 'READY' || item.status === 'REWORK') && (
                      <Button
                        className="w-full flex items-center justify-center gap-2"
                        size="sm"
                        disabled={isPendingAction}
                        onClick={() => handleStart(item.id)}
                      >
                        <Play className="h-4 w-4" />
                        Bắt đầu làm việc
                      </Button>
                    )}

                    {item.status === 'IN_PROGRESS' && (
                      <Button
                        variant="primary"
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-2"
                        size="sm"
                        disabled={isPendingAction}
                        onClick={() => handleComplete(item.id)}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Hoàn thành công đoạn
                      </Button>
                    )}

                    {item.status === 'WAITING_QC' && (
                      <div className="text-center py-1 text-xs text-purple-700 font-medium">
                        Đang chờ QC Inspector phê duyệt
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
