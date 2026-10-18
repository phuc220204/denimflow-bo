import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Clock,
  Filter,
  Paperclip,
  Play,
  PlusCircle,
  RefreshCw,
  Scale,
  ShieldCheck,
  X,
} from 'lucide-react';
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
import {
  approveQcApi,
  attachEvidenceApi,
  completeStepApi,
  evaluateQcInspectionApi,
  fetchReworkTargetsApi,
  fetchWorklistApi,
  generateBundlesApi,
  recordQcInspectionApi,
  recordQuantityApi,
  startStepApi,
} from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import type {
  AttachEvidenceDto,
  QcEvaluationOutputDto,
  QcResult,
  RecordQuantityEntryDto,
  StepStatus,
  WorklistItemDto,
} from '@denimflow/shared';

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

  // Quantity entry modal state
  const [selectedStep, setSelectedStep] = useState<WorklistItemDto | null>(null);
  const [qtySize, setQtySize] = useState<string>('30');
  const [qtyGood, setQtyGood] = useState<number>(0);
  const [qtyDefect, setQtyDefect] = useState<number>(0);
  const [qtySent, setQtySent] = useState<number | undefined>(undefined);
  const [qtyReceived, setQtyReceived] = useState<number | undefined>(undefined);
  const [mismatchReason, setMismatchReason] = useState<string>('');
  const [qtyNote, setQtyNote] = useState<string>('');

  // Evidence attachment modal state (T4.4, BR-15)
  const [selectedStepForEvidence, setSelectedStepForEvidence] = useState<WorklistItemDto | null>(
    null,
  );
  const [evidenceFilePath, setEvidenceFilePath] = useState<string>('');
  const [evidenceNote, setEvidenceNote] = useState<string>('');

  // QC Inspection modal state (T5.1, FR-16, BR-19)
  const [selectedStepForQc, setSelectedStepForQc] = useState<WorklistItemDto | null>(null);
  const [qcSampleSize, setQcSampleSize] = useState<number>(50);
  const [qcShrinkage, setQcShrinkage] = useState<string>('2.5');
  const [qcFading, setQcFading] = useState<number>(1);
  const [qcDefectType, setQcDefectType] = useState<string>('BROKEN_STITCH');
  const [qcDefectQty, setQcDefectQty] = useState<number>(0);
  const [qcResult, setQcResult] = useState<QcResult>('PASS');
  const [qcReason, setQcReason] = useState<string>('');
  const [qcNotes, setQcNotes] = useState<string>('');
  const [reworkTargetStepId, setReworkTargetStepId] = useState<string>('');
  const [evaluationResult, setEvaluationResult] = useState<QcEvaluationOutputDto | null>(null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);

  const { data: reworkTargets = [] } = useQuery({
    queryKey: ['rework-targets', selectedStepForQc?.id],
    queryFn: () => (selectedStepForQc ? fetchReworkTargetsApi(selectedStepForQc.id, token) : []),
    enabled: !!selectedStepForQc,
  });

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

  const recordQuantityMutation = useMutation({
    mutationFn: ({ stepId, dto }: { stepId: string; dto: RecordQuantityEntryDto }) =>
      recordQuantityApi(stepId, dto, token),
    onSuccess: () => {
      setActionSuccess('Đã ghi nhận sản lượng thành công (BR-08)!');
      setActionError(null);
      setSelectedStep(null);
      void queryClient.invalidateQueries({ queryKey: ['worklist'] });
    },
    onError: (err: Error) => {
      setActionError(err.message || 'Không thể ghi nhận sản lượng');
    },
  });

  const generateBundlesMutation = useMutation({
    mutationFn: (stepId: string) => generateBundlesApi(stepId, token),
    onSuccess: (bundles) => {
      setActionSuccess(`Đã tạo thành công ${bundles.length} kiện hàng theo quy chuẩn (FR-15)!`);
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ['worklist'] });
    },
    onError: (err: Error) => {
      setActionError(err.message || 'Không thể tạo kiện hàng');
    },
  });

  const attachEvidenceMutation = useMutation({
    mutationFn: ({ stepId, dto }: { stepId: string; dto: AttachEvidenceDto }) =>
      attachEvidenceApi(stepId, dto, token),
    onSuccess: () => {
      setActionSuccess('Đã đính kèm minh chứng thành công (BR-15)!');
      setActionError(null);
      setSelectedStepForEvidence(null);
      void queryClient.invalidateQueries({ queryKey: ['worklist'] });
    },
    onError: (err: Error) => {
      setActionError(err.message || 'Không thể đính kèm minh chứng');
    },
  });

  const approveQcMutation = useMutation({
    mutationFn: (stepId: string) => approveQcApi(stepId, {}, token),
    onSuccess: () => {
      setActionSuccess('Đã phê duyệt QC thành công (BR-11)!');
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ['worklist'] });
    },
    onError: (err: Error) => {
      setActionError(err.message || 'Không thể phê duyệt QC');
    },
  });

  const recordQcMutation = useMutation({
    mutationFn: (dto: {
      stepInstanceId: string;
      sampleSize: number;
      measuredShrinkagePercent?: number;
      measuredColorFadingLevel?: number;
      result: QcResult;
      reworkTargetStepId?: string;
      reason?: string;
      notes?: string;
      defects?: Array<{ defectType: string; qty: number }>;
    }) => recordQcInspectionApi(dto, token),
    onSuccess: (data) => {
      setActionSuccess(`Đã ghi nhận kiểm tra QC [${data.result}] thành công (FR-16, BR-19)!`);
      setActionError(null);
      setSelectedStepForQc(null);
      void queryClient.invalidateQueries({ queryKey: ['worklist'] });
    },
    onError: (err: Error) => {
      setActionError(err.message || 'Không thể lưu biên bản kiểm tra QC');
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

  const handleApproveQc = (stepId: string) => {
    setActionError(null);
    setActionSuccess(null);
    approveQcMutation.mutate(stepId);
  };

  const openQcModal = (step: WorklistItemDto) => {
    setSelectedStepForQc(step);
    setReworkTargetStepId(step.id);
    setQcSampleSize(Math.min(step.qtyGood || step.totalPlannedQty || 50, 100));
    setQcShrinkage('2.5');
    setQcFading(1);
    setQcDefectType('BROKEN_STITCH');
    setQcDefectQty(0);
    setQcResult('PASS');
    setQcReason('');
    setQcNotes('');
    setEvaluationResult(null);
  };

  const handleEvaluateQc = async () => {
    if (!selectedStepForQc) return;
    try {
      setIsEvaluating(true);
      const output = await evaluateQcInspectionApi(
        selectedStepForQc.id,
        {
          sampleSize: qcSampleSize,
          measuredShrinkagePercent: qcShrinkage ? parseFloat(qcShrinkage) : undefined,
          measuredColorFadingLevel: qcFading,
          defects: qcDefectQty > 0 ? [{ defectType: qcDefectType, qty: qcDefectQty }] : [],
        },
        token,
      );
      setEvaluationResult(output);
      setQcResult(output.proposedResult);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Lỗi đánh giá tiêu chuẩn QC');
    } finally {
      setIsEvaluating(false);
    }
  };

  const submitQcInspection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStepForQc) return;
    recordQcMutation.mutate({
      stepInstanceId: selectedStepForQc.id,
      sampleSize: qcSampleSize,
      measuredShrinkagePercent: qcShrinkage ? parseFloat(qcShrinkage) : undefined,
      measuredColorFadingLevel: qcFading,
      result: qcResult,
      reworkTargetStepId: qcResult !== 'PASS' ? reworkTargetStepId : undefined,
      reason: qcReason || undefined,
      notes: qcNotes || undefined,
      defects: qcDefectQty > 0 ? [{ defectType: qcDefectType, qty: qcDefectQty }] : [],
    });
  };

  const openEvidenceModal = (step: WorklistItemDto) => {
    setSelectedStepForEvidence(step);
    setEvidenceFilePath(`orders/${step.orderId}/evidence/${step.stepCode.toLowerCase()}-proof.jpg`);
    setEvidenceNote('');
  };

  const submitEvidence = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStepForEvidence) return;
    attachEvidenceMutation.mutate({
      stepId: selectedStepForEvidence.id,
      dto: { filePath: evidenceFilePath, note: evidenceNote || undefined },
    });
  };

  const openQuantityModal = (step: WorklistItemDto) => {
    setSelectedStep(step);
    setQtyGood(0);
    setQtyDefect(0);
    setQtySent(undefined);
    setQtyReceived(undefined);
    setMismatchReason('');
    setQtyNote('');
  };

  const submitQuantity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStep) return;

    const dto: RecordQuantityEntryDto = {
      size: qtySize,
      qtyGood: Number(qtyGood),
      qtyDefect: Number(qtyDefect),
      qtySent: qtySent !== undefined ? Number(qtySent) : undefined,
      qtyReceived: qtyReceived !== undefined ? Number(qtyReceived) : undefined,
      mismatchReason: mismatchReason || undefined,
      note: qtyNote || undefined,
    };

    recordQuantityMutation.mutate({ stepId: selectedStep.id, dto });
  };

  const isOperator = user?.role === 'STATION_OPERATOR';

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">Danh sách công việc trạm</h1>
          <p className="text-sm text-text-muted mt-1">
            Quản lý công đoạn sản xuất, ghi nhận sản lượng bảo toàn và hoàn thành quy trình (FR-12,
            FR-13).
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

            const isPendingAction =
              startMutation.isPending ||
              completeMutation.isPending ||
              approveQcMutation.isPending ||
              recordQcMutation.isPending ||
              generateBundlesMutation.isPending;

            const isCutting = item.stepCode === 'CUTTING';

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
                      <span className="block text-text-muted">Kế hoạch:</span>
                      <span className="font-semibold text-text">{item.totalPlannedQty} cái</span>
                    </div>
                  </div>

                  {/* Quantity metrics (FR-13, BR-08) */}
                  <div className="grid grid-cols-3 gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded text-center">
                    <div>
                      <span className="block text-[11px] text-slate-500">Đầu vào</span>
                      <span className="font-bold text-slate-800">
                        {item.qtyIn !== null && item.qtyIn !== undefined ? item.qtyIn : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[11px] text-emerald-600">Đạt</span>
                      <span className="font-bold text-emerald-700">{item.qtyGood ?? 0}</span>
                    </div>
                    <div>
                      <span className="block text-[11px] text-rose-600">Lỗi/Hỏng</span>
                      <span className="font-bold text-rose-700">{item.qtyDefect ?? 0}</span>
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
                  <div className="pt-2 space-y-2">
                    {isCutting && (item.status === 'READY' || item.status === 'IN_PROGRESS') && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full flex items-center justify-center gap-1.5 text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                        disabled={isPendingAction}
                        onClick={() => generateBundlesMutation.mutate(item.id)}
                      >
                        <Boxes className="h-3.5 w-3.5" />
                        Tạo kiện hàng cắt (FR-15)
                      </Button>
                    )}

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
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full flex items-center justify-center gap-1.5 text-blue-700 border-blue-200 hover:bg-blue-50"
                          disabled={isPendingAction}
                          onClick={() => openQuantityModal(item)}
                        >
                          <PlusCircle className="h-3.5 w-3.5" />
                          Nhập sản lượng (FR-13)
                        </Button>

                        {item.requiresEvidence && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full flex items-center justify-center gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50"
                            disabled={isPendingAction}
                            onClick={() => openEvidenceModal(item)}
                          >
                            <Paperclip className="h-3.5 w-3.5" />
                            Đính kèm minh chứng (BR-15)
                          </Button>
                        )}

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
                      </>
                    )}

                    {item.status === 'WAITING_QC' && (
                      <div className="space-y-2">
                        <div className="text-center py-1 text-xs text-purple-700 font-medium">
                          Đang chờ QC Inspector kiểm định
                        </div>
                        {(user?.role === 'QC_INSPECTOR' || user?.role === 'ADMIN') && (
                          <div className="flex flex-col gap-1.5">
                            <Button
                              variant="primary"
                              className="w-full bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center gap-2"
                              size="sm"
                              disabled={isPendingAction}
                              onClick={() => openQcModal(item)}
                            >
                              <ShieldCheck className="h-4 w-4" />
                              Kiểm định QC theo Profile (FR-16)
                            </Button>
                            <Button
                              variant="outline"
                              className="w-full text-purple-700 border-purple-200 hover:bg-purple-50 flex items-center justify-center gap-2"
                              size="sm"
                              disabled={isPendingAction}
                              onClick={() => handleApproveQc(item.id)}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Phê duyệt QC (BR-11)
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Quantity Entry Modal (FR-13, BR-07, BR-08, BR-09) */}
      {selectedStep && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-lg text-text">
                  Ghi nhận sản lượng ({selectedStep.stepCode})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStep(null)}
                className="text-text-muted hover:text-text"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submitQuantity} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">
                  Kích cỡ (Size)
                </label>
                <select
                  value={qtySize}
                  onChange={(e) => setQtySize(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-1.5 text-sm bg-background"
                >
                  <option value="28">Size 28</option>
                  <option value="29">Size 29</option>
                  <option value="30">Size 30</option>
                  <option value="31">Size 31</option>
                  <option value="32">Size 32</option>
                  <option value="34">Size 34</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-emerald-700 mb-1">
                    Số lượng đạt (qtyGood) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={qtyGood}
                    onChange={(e) => setQtyGood(Number(e.target.value))}
                    className="w-full border border-border rounded-lg px-3 py-1.5 text-sm bg-background"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-rose-700 mb-1">
                    Số lượng lỗi (qtyDefect)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={qtyDefect}
                    onChange={(e) => setQtyDefect(Number(e.target.value))}
                    className="w-full border border-border rounded-lg px-3 py-1.5 text-sm bg-background"
                  />
                </div>
              </div>

              {/* Outsourced reconciliation (BR-09) */}
              {(selectedStep.stationType === 'DYEING' || selectedStep.stationType === 'WASH') && (
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg space-y-2.5">
                  <span className="text-xs font-semibold text-amber-900 block">
                    Đối soát gia công ngoài (BR-09)
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-amber-800 mb-0.5">
                        SL gửi đi (Sent)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={qtySent ?? ''}
                        onChange={(e) =>
                          setQtySent(e.target.value ? Number(e.target.value) : undefined)
                        }
                        className="w-full border border-amber-300 rounded px-2.5 py-1 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-amber-800 mb-0.5">
                        SL nhận về (Received)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={qtyReceived ?? ''}
                        onChange={(e) =>
                          setQtyReceived(e.target.value ? Number(e.target.value) : undefined)
                        }
                        className="w-full border border-amber-300 rounded px-2.5 py-1 text-xs bg-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-amber-800 mb-0.5">
                      Lý do chênh lệch (Bắt buộc nếu gửi ≠ nhận)
                    </label>
                    <input
                      type="text"
                      placeholder="VD: Hao hụt nhiệt 3 cái..."
                      value={mismatchReason}
                      onChange={(e) => setMismatchReason(e.target.value)}
                      className="w-full border border-amber-300 rounded px-2.5 py-1 text-xs bg-white"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Ghi chú</label>
                <input
                  type="text"
                  placeholder="Ghi chú thêm nếu có..."
                  value={qtyNote}
                  onChange={(e) => setQtyNote(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-1.5 text-sm bg-background"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedStep(null)}
                  disabled={recordQuantityMutation.isPending}
                >
                  Hủy bỏ
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={recordQuantityMutation.isPending}
                >
                  {recordQuantityMutation.isPending ? 'Đang lưu...' : 'Xác nhận ghi nhận'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Evidence Attachment Modal (FR-14, BR-15) */}
      {selectedStepForEvidence && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Paperclip className="h-5 w-5 text-amber-600" />
                <h3 className="font-semibold text-lg text-text">
                  Đính kèm minh chứng ({selectedStepForEvidence.stepCode})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStepForEvidence(null)}
                className="text-text-muted hover:text-text"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submitEvidence} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">
                  Đường dẫn tệp / ảnh minh chứng (filePath) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="orders/.../evidence/proof.jpg"
                  value={evidenceFilePath}
                  onChange={(e) => setEvidenceFilePath(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-1.5 text-sm bg-background font-mono text-xs"
                />
                <span className="text-[11px] text-text-muted mt-0.5 block">
                  Lưu trữ trong Supabase Private Storage Bucket (BR-15).
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">
                  Ghi chú minh chứng
                </label>
                <textarea
                  rows={2}
                  placeholder="Ghi chú về hình ảnh hoặc kết quả kiểm tra..."
                  value={evidenceNote}
                  onChange={(e) => setEvidenceNote(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-1.5 text-sm bg-background"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedStepForEvidence(null)}
                  disabled={attachEvidenceMutation.isPending}
                >
                  Hủy bỏ
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={attachEvidenceMutation.isPending}
                >
                  {attachEvidenceMutation.isPending ? 'Đang lưu...' : 'Lưu minh chứng'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QC Inspection Modal (T5.1, FR-16, BR-11, BR-19) */}
      {selectedStepForQc && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-xl max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-purple-600" />
                <div>
                  <h3 className="font-semibold text-lg text-text">
                    Kiểm định QC ({selectedStepForQc.stepCode})
                  </h3>
                  <p className="text-xs text-text-muted">
                    Đơn hàng: {selectedStepForQc.orderNumber} · Style: {selectedStepForQc.styleCode}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStepForQc(null)}
                className="text-text-muted hover:text-text p-1 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submitQcInspection} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">
                    Cỡ mẫu kiểm tra *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={qcSampleSize}
                    onChange={(e) => setQcSampleSize(parseInt(e.target.value) || 1)}
                    className="w-full border border-border rounded-lg px-3 py-1.5 text-sm bg-background"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">
                    Độ co giãn đo được (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    max={100}
                    value={qcShrinkage}
                    onChange={(e) => setQcShrinkage(e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-1.5 text-sm bg-background"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">
                    Độ phai màu (cấp 0-5)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={5}
                    value={qcFading}
                    onChange={(e) => setQcFading(parseInt(e.target.value) || 0)}
                    className="w-full border border-border rounded-lg px-3 py-1.5 text-sm bg-background"
                  />
                </div>
              </div>

              {/* Defect section (FR-18) */}
              <div className="p-3 bg-muted/40 rounded-lg space-y-2 border border-border/60">
                <span className="block text-xs font-semibold text-text">
                  Ghi nhận khuyết tật / lỗi (FR-18)
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-text-muted mb-0.5">
                      Loại khuyết tật
                    </label>
                    <select
                      value={qcDefectType}
                      onChange={(e) => setQcDefectType(e.target.value)}
                      className="w-full border border-border rounded px-2 py-1 text-xs bg-background"
                    >
                      <option value="BROKEN_STITCH">Đứt chỉ / Nhảy mũi</option>
                      <option value="OIL_STAIN">Vết ố / Vết dầu</option>
                      <option value="SHADING">Lệch màu vải</option>
                      <option value="MEASUREMENT_OUT">Lệch thông số kích thước</option>
                      <option value="FABRIC_TEAR">Rách / Xước vải</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-text-muted mb-0.5">Số lượng lỗi</label>
                    <input
                      type="number"
                      min={0}
                      value={qcDefectQty}
                      onChange={(e) => setQcDefectQty(parseInt(e.target.value) || 0)}
                      className="w-full border border-border rounded px-2 py-1 text-xs bg-background"
                    />
                  </div>
                </div>
              </div>

              {/* Engine evaluation trigger button */}
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full flex items-center justify-center gap-1.5 text-purple-700 border-purple-300 hover:bg-purple-50"
                  disabled={isEvaluating}
                  onClick={handleEvaluateQc}
                >
                  <Scale className="h-4 w-4" />
                  {isEvaluating
                    ? 'Đang phân tích...'
                    : 'Đánh giá tự động theo QC Profile (Strategy BR-19)'}
                </Button>
              </div>

              {/* Evaluation recommendation banner */}
              {evaluationResult && (
                <div
                  className={`p-3 rounded-lg border text-xs space-y-1 ${
                    evaluationResult.passed
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : evaluationResult.proposedResult === 'REWORK'
                        ? 'bg-amber-50 border-amber-300 text-amber-800'
                        : 'bg-rose-50 border-rose-300 text-rose-800'
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold text-sm">
                    <span>Đề xuất của hệ thống:</span>
                    <Badge
                      tone={
                        evaluationResult.passed
                          ? 'success'
                          : evaluationResult.proposedResult === 'REWORK'
                            ? 'warning'
                            : 'danger'
                      }
                    >
                      {evaluationResult.proposedResult}
                    </Badge>
                  </div>
                  {evaluationResult.reasons.length > 0 && (
                    <ul className="list-disc pl-4 space-y-0.5 mt-1">
                      {evaluationResult.reasons.map((r, idx) => (
                        <li key={idx}>{r}</li>
                      ))}
                    </ul>
                  )}
                  {evaluationResult.passed && (
                    <p>Các chỉ số độ co, phai màu và tỷ lệ lỗi đều nằm trong ngưỡng tiêu chuẩn.</p>
                  )}
                </div>
              )}

              {/* Inspector final decision */}
              <div className="space-y-2 pt-2 border-t border-border">
                <label className="block text-xs font-semibold text-text">
                  Kết luận của QC Inspector *
                </label>
                <div className="flex gap-4">
                  {(['PASS', 'REWORK', 'REJECT'] as const).map((res) => (
                    <label
                      key={res}
                      className="flex items-center gap-1.5 text-xs font-medium cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="qcResult"
                        value={res}
                        checked={qcResult === res}
                        onChange={() => setQcResult(res)}
                        className="text-primary"
                      />
                      <span>
                        {res === 'PASS'
                          ? 'ĐẠT (PASS)'
                          : res === 'REWORK'
                            ? 'LÀM LẠI (REWORK)'
                            : 'TỪ CHỐI (REJECT)'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {qcResult !== 'PASS' && (
                <div className="space-y-3 p-3 bg-amber-50/60 rounded-lg border border-amber-200">
                  <div>
                    <label className="block text-xs font-semibold text-amber-900 mb-1">
                      Công đoạn quay về làm lại (BR-10) *
                    </label>
                    <select
                      value={reworkTargetStepId}
                      onChange={(e) => setReworkTargetStepId(e.target.value)}
                      className="w-full border border-amber-300 rounded-lg px-3 py-1.5 text-sm bg-white"
                      required
                    >
                      <option value="">-- Chọn công đoạn làm lại --</option>
                      {reworkTargets.map((target) => (
                        <option key={target.id} value={target.id}>
                          [{target.code}] {target.name} (Lần sửa: {target.reworkCount}/
                          {target.maxRework})
                        </option>
                      ))}
                    </select>
                    {reworkTargets.find(
                      (t) => t.id === reworkTargetStepId && t.reworkCount >= t.maxRework,
                    ) && (
                      <p className="text-[11px] text-rose-600 font-medium mt-1">
                        ⚠️ Công đoạn này đã đạt giới hạn làm lại tối đa (
                        {reworkTargets.find((t) => t.id === reworkTargetStepId)?.maxRework} lần).
                        Gửi yêu cầu này sẽ kích hoạt quy trình xử lý ngoại lệ của Production Planner
                        (BR-10).
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-amber-900 mb-1">
                      Lý do làm lại / không đạt * (Bắt buộc theo BR-10)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Nêu rõ lý do hoặc lỗi kỹ thuật cần làm lại..."
                      value={qcReason}
                      onChange={(e) => setQcReason(e.target.value)}
                      className="w-full border border-amber-300 rounded-lg px-3 py-1.5 text-sm bg-white"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">
                  Ghi chú thêm
                </label>
                <textarea
                  rows={2}
                  placeholder="Ghi chú kết quả kiểm tra..."
                  value={qcNotes}
                  onChange={(e) => setQcNotes(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-1.5 text-sm bg-background"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedStepForQc(null)}
                  disabled={recordQcMutation.isPending}
                >
                  Hủy bỏ
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={recordQcMutation.isPending}
                >
                  {recordQcMutation.isPending ? 'Đang lưu...' : 'Xác nhận kết quả QC'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
