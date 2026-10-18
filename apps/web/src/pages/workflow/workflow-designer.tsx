import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  GitFork,
  Layers,
  Plus,
  Send,
  ShieldCheck,
  Tag,
  X,
} from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import {
  addStepApi,
  addTransitionApi,
  assignTemplateToStyleApi,
  createWorkflowTemplateApi,
  createWorkflowVersionApi,
  deleteStepApi,
  deleteTransitionApi,
  fetchStyles,
  fetchWorkflowTemplatesApi,
  fetchWorkflowVersionApi,
  publishWorkflowVersionApi,
  updateStepApi,
  validateWorkflowVersionApi,
  type WorkflowValidationViolation,
  ApiViolationError,
} from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { i18n } from '../../lib/i18n/dictionary';
import { StepListTab } from './step-list-tab';
import { TransitionsTab } from './transitions-tab';
import { WorkflowGraph } from './workflow-graph';

type ActiveTab = 'graph' | 'steps' | 'transitions';

export const WorkflowDesignerPage: React.FC = () => {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('graph');

  // New Template modal state
  const [isNewTemplateModalOpen, setIsNewTemplateModalOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateIsDedicated, setNewTemplateIsDedicated] = useState(false);

  // Assign to Style modal state
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedStyleId, setSelectedStyleId] = useState<string>('');

  // Validation state
  const [validationViolations, setValidationViolations] = useState<
    WorkflowValidationViolation[] | null
  >(null);
  const [validationSuccess, setValidationSuccess] = useState(false);
  const [selectedGraphStepId, setSelectedGraphStepId] = useState<string | null>(null);

  // Queries
  const { data: templates = [], isLoading: isTemplatesLoading } = useQuery({
    queryKey: ['workflow-templates'],
    queryFn: () => fetchWorkflowTemplatesApi(token),
  });

  const { data: styles = [] } = useQuery({
    queryKey: ['catalog-styles'],
    queryFn: () => fetchStyles(),
  });

  // Automatically select the first template if none selected
  const activeTemplate = useMemo(() => {
    if (!templates.length) return null;
    return templates.find((t) => t.id === selectedTemplateId) || templates[0];
  }, [templates, selectedTemplateId]);

  // Synchronize selectedTemplateId
  React.useEffect(() => {
    if (activeTemplate && activeTemplate.id !== selectedTemplateId) {
      setSelectedTemplateId(activeTemplate.id);
    }
  }, [activeTemplate, selectedTemplateId]);

  // Automatically select the latest or current version if none selected
  const activeVersionSummary = useMemo(() => {
    if (!activeTemplate || !activeTemplate.versions.length) return null;
    if (selectedVersionId) {
      const match = activeTemplate.versions.find((v) => v.id === selectedVersionId);
      if (match) return match;
    }
    // Default to currentVersionId or latest version
    if (activeTemplate.currentVersionId) {
      const current = activeTemplate.versions.find((v) => v.id === activeTemplate.currentVersionId);
      if (current) return current;
    }
    return activeTemplate.versions[activeTemplate.versions.length - 1];
  }, [activeTemplate, selectedVersionId]);

  React.useEffect(() => {
    if (activeVersionSummary && activeVersionSummary.id !== selectedVersionId) {
      setSelectedVersionId(activeVersionSummary.id);
    }
  }, [activeVersionSummary, selectedVersionId]);

  // Fetch full details of the active version
  const {
    data: versionDetail,
    isLoading: isVersionLoading,
    refetch: refetchVersion,
  } = useQuery({
    queryKey: ['workflow-version', activeVersionSummary?.id],
    queryFn: () => fetchWorkflowVersionApi(activeVersionSummary!.id, token),
    enabled: Boolean(activeVersionSummary?.id),
  });

  // Mutations
  const createTemplateMutation = useMutation({
    mutationFn: (dto: { name: string; isDedicated: boolean }) =>
      createWorkflowTemplateApi(dto, token),
    onSuccess: (newTemplate) => {
      queryClient.invalidateQueries({ queryKey: ['workflow-templates'] });
      setSelectedTemplateId(newTemplate.id);
      setIsNewTemplateModalOpen(false);
      setNewTemplateName('');
      setNewTemplateIsDedicated(false);
    },
  });

  const createVersionMutation = useMutation({
    mutationFn: (templateId: string) => createWorkflowVersionApi(templateId, token),
    onSuccess: (newVersion) => {
      queryClient.invalidateQueries({ queryKey: ['workflow-templates'] });
      setSelectedVersionId(newVersion.id);
      setValidationViolations(null);
      setValidationSuccess(false);
    },
  });

  const validateMutation = useMutation({
    mutationFn: (versionId: string) => validateWorkflowVersionApi(versionId, token),
    onSuccess: (res) => {
      if (res.valid) {
        setValidationSuccess(true);
        setValidationViolations(null);
      } else {
        setValidationSuccess(false);
        setValidationViolations(res.violations);
      }
    },
    onError: (err) => {
      setValidationSuccess(false);
      setValidationViolations([
        {
          code: 'API_ERROR',
          message: err instanceof Error ? err.message : 'Lỗi kiểm tra quy trình',
        },
      ]);
    },
  });

  const publishMutation = useMutation({
    mutationFn: (versionId: string) => publishWorkflowVersionApi(versionId, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-templates'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-version'] });
      setValidationSuccess(true);
      setValidationViolations(null);
      alert('Xuất bản quy trình thành công! Phiên bản này hiện đã có hiệu lực chính thức.');
    },
    onError: (err) => {
      setValidationSuccess(false);
      if (err instanceof ApiViolationError && err.details?.violations) {
        setValidationViolations(err.details.violations);
      } else {
        setValidationViolations([
          {
            code: 'PUBLISH_ERROR',
            message: err instanceof Error ? err.message : 'Xuất bản thất bại',
          },
        ]);
      }
    },
  });

  const assignStyleMutation = useMutation({
    mutationFn: (dto: { styleId: string; templateId: string }) =>
      assignTemplateToStyleApi(dto, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-templates'] });
      queryClient.invalidateQueries({ queryKey: ['catalog-styles'] });
      setIsAssignModalOpen(false);
      alert('Đã gán mẫu quy trình cho mã hàng thành công!');
    },
  });

  const isDraft = versionDetail?.status === 'DRAFT';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-text">Thiết kế quy trình sản xuất</h1>
            <Badge tone="info" className="text-xs">
              FR-04 &bull; FR-05
            </Badge>
          </div>
          <p className="text-xs text-text-muted mt-1">
            Xây dựng chuỗi vận hành động, kiểm tra hợp lệ chu trình (BR-01) và xuất bản phiên bản
            (BR-02).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* New Template button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsNewTemplateModalOpen(true)}
            className="flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            <span>Tạo quy trình mới</span>
          </Button>

          {/* New Version button */}
          {activeTemplate && (
            <Button
              variant="outline"
              size="sm"
              disabled={createVersionMutation.isPending}
              onClick={() => createVersionMutation.mutate(activeTemplate.id)}
              className="flex items-center gap-1.5"
            >
              <GitBranch className="h-4 w-4" />
              <span>{createVersionMutation.isPending ? 'Đang tạo...' : '+ Tạo bản nháp mới'}</span>
            </Button>
          )}

          {/* Validate button */}
          {versionDetail && (
            <Button
              variant="secondary"
              size="sm"
              disabled={validateMutation.isPending}
              onClick={() => validateMutation.mutate(versionDetail.id)}
              className="flex items-center gap-1.5"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>{validateMutation.isPending ? 'Đang kiểm tra...' : 'Kiểm tra BR-01'}</span>
            </Button>
          )}

          {/* Publish button */}
          {versionDetail && (
            <Button
              variant="primary"
              size="sm"
              disabled={!isDraft || publishMutation.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    'Bạn có chắc chắn muốn xuất bản phiên bản quy trình này? Phiên bản xuất bản sẽ bị đóng băng bất biến (BR-02).',
                  )
                ) {
                  publishMutation.mutate(versionDetail.id);
                }
              }}
              className="flex items-center gap-1.5"
            >
              <Send className="h-4 w-4" />
              <span>{publishMutation.isPending ? 'Đang xuất bản...' : 'Xuất bản (Publish)'}</span>
            </Button>
          )}

          {/* Assign to style button */}
          {activeTemplate && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedStyleId(styles[0]?.id || '');
                setIsAssignModalOpen(true);
              }}
              className="flex items-center gap-1.5"
            >
              <Tag className="h-4 w-4" />
              <span>Gán mã hàng</span>
            </Button>
          )}
        </div>
      </div>

      {/* Selectors Bar */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-surface p-4">
        {/* Template Selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-text whitespace-nowrap">
            Mẫu quy trình:
          </label>
          {isTemplatesLoading ? (
            <span className="text-xs text-text-muted">Đang tải...</span>
          ) : (
            <select
              value={activeTemplate?.id || ''}
              onChange={(e) => {
                setSelectedTemplateId(e.target.value);
                setValidationViolations(null);
                setValidationSuccess(false);
              }}
              className="h-8 rounded border border-border bg-background px-3 text-xs font-medium text-text focus:outline-none focus:ring-1 focus:ring-primary min-w-[200px]"
            >
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.name} {tpl.isDedicated ? '(Riêng đơn)' : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Version Selector */}
        {activeTemplate && activeTemplate.versions.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-text whitespace-nowrap">Phiên bản:</label>
            <select
              value={versionDetail?.id || activeVersionSummary?.id || ''}
              onChange={(e) => {
                setSelectedVersionId(e.target.value);
                setValidationViolations(null);
                setValidationSuccess(false);
              }}
              className="h-8 rounded border border-border bg-background px-3 text-xs font-medium text-text focus:outline-none focus:ring-1 focus:ring-primary min-w-[160px]"
            >
              {activeTemplate.versions.map((ver) => (
                <option key={ver.id} value={ver.id}>
                  Phiên bản v{ver.versionNo} ({i18n.versionStatus[ver.status]})
                </option>
              ))}
            </select>

            {versionDetail && (
              <Badge
                tone={
                  versionDetail.status === 'PUBLISHED'
                    ? 'success'
                    : versionDetail.status === 'DRAFT'
                      ? 'warning'
                      : 'neutral'
                }
                className="text-xs"
              >
                {i18n.versionStatus[versionDetail.status]}
              </Badge>
            )}
          </div>
        )}

        {/* Assigned Styles summary */}
        {activeTemplate?.styles && activeTemplate.styles.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-text-muted ml-auto">
            <span>Mã hàng áp dụng:</span>
            {activeTemplate.styles.map((s) => (
              <Badge key={s.id} tone="neutral" className="text-[11px]">
                {s.styleCode}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Immutability Banner for PUBLISHED / RETIRED versions (BR-02) */}
      {!isDraft && versionDetail && (
        <div className="flex items-center gap-3 rounded-md bg-amber-50 p-3.5 text-xs text-amber-800 border border-amber-200">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold">
              Phiên bản đã xuất bản / đóng băng (Bất biến theo quy tắc BR-02)
            </p>
            <p className="text-amber-700 mt-0.5">
              Bạn đang xem phiên bản ở chế độ chỉ đọc. Để thêm, sửa hoặc xóa các bước và chuyển
              tiếp, vui lòng bấm nút <strong>"+ Tạo bản nháp mới"</strong> ở góc trên bên phải.
            </p>
          </div>
        </div>
      )}

      {/* Validation Banner */}
      {validationSuccess && (
        <div className="flex items-center gap-3 rounded-md bg-emerald-50 p-3.5 text-xs text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          <div>
            <p className="font-semibold">Quy trình hoàn toàn hợp lệ (Tuân thủ BR-01)</p>
            <p className="text-emerald-700 mt-0.5">
              Tất cả các bước đạt tiêu chuẩn: đúng 1 bước bắt đầu, có bước kết thúc, mọi đường đi
              đều tiếp cận được kết thúc và không có chu trình vô hạn.
            </p>
          </div>
        </div>
      )}

      {validationViolations && validationViolations.length > 0 && (
        <div className="rounded-md bg-rose-50 p-4 text-xs text-rose-900 border border-rose-200 space-y-2">
          <div className="flex items-center gap-2 font-bold text-danger text-sm">
            <AlertCircle className="h-4 w-4" />
            <span>Phát hiện {validationViolations.length} vi phạm quy chuẩn thiết kế (BR-01):</span>
          </div>
          <ul className="list-disc list-inside space-y-1 pl-2">
            {validationViolations.map((v, i) => (
              <li key={i}>
                <strong className="font-mono text-rose-800">[{v.code}]</strong>: {v.message}
                {v.stepIds && v.stepIds.length > 0 && (
                  <span className="ml-1 text-rose-700">(Liên quan: {v.stepIds.join(', ')})</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="border-b border-border">
        <nav className="flex space-x-6 text-sm font-medium">
          <button
            onClick={() => setActiveTab('graph')}
            className={`pb-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'graph'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            <GitFork className="h-4 w-4" />
            <span>Sơ đồ trực quan (Graph Preview)</span>
          </button>

          <button
            onClick={() => setActiveTab('steps')}
            className={`pb-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'steps'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Danh sách bước ({versionDetail?.steps?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('transitions')}
            className={`pb-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'transitions'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            <GitBranch className="h-4 w-4" />
            <span>Chuyển tiếp & Rẽ nhánh ({versionDetail?.transitions?.length || 0})</span>
          </button>
        </nav>
      </div>

      {/* Tab Contents */}
      {isVersionLoading ? (
        <div className="flex h-64 items-center justify-center text-xs text-text-muted">
          Đang tải chi tiết phiên bản quy trình...
        </div>
      ) : !versionDetail ? (
        <div className="flex h-64 items-center justify-center text-xs text-text-muted">
          Không tìm thấy phiên bản quy trình nào. Vui lòng tạo quy trình hoặc phiên bản mới.
        </div>
      ) : (
        <div>
          {activeTab === 'graph' && (
            <WorkflowGraph
              steps={versionDetail.steps}
              transitions={versionDetail.transitions}
              selectedStepId={selectedGraphStepId}
              onSelectStep={(id) => {
                setSelectedGraphStepId(id);
                setActiveTab('steps');
              }}
              violations={validationViolations || []}
            />
          )}

          {activeTab === 'steps' && (
            <StepListTab
              steps={versionDetail.steps}
              isDraft={isDraft}
              onAddStep={async (dto) => {
                await addStepApi(versionDetail.id, dto, token);
                await refetchVersion();
              }}
              onUpdateStep={async (id, dto) => {
                await updateStepApi(id, dto, token);
                await refetchVersion();
              }}
              onDeleteStep={async (id) => {
                await deleteStepApi(id, token);
                await refetchVersion();
              }}
            />
          )}

          {activeTab === 'transitions' && (
            <TransitionsTab
              steps={versionDetail.steps}
              transitions={versionDetail.transitions}
              isDraft={isDraft}
              onAddTransition={async (dto) => {
                await addTransitionApi(versionDetail.id, dto, token);
                await refetchVersion();
              }}
              onDeleteTransition={async (id) => {
                await deleteTransitionApi(id, token);
                await refetchVersion();
              }}
            />
          )}
        </div>
      )}

      {/* New Template Modal */}
      {isNewTemplateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md shadow-xl bg-surface border-border">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="font-semibold text-base text-text">Tạo mẫu quy trình mới</h3>
                <button
                  onClick={() => setIsNewTemplateModalOpen(false)}
                  className="rounded p-1 text-text-muted hover:bg-background"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-text mb-1">
                    Tên mẫu quy trình <span className="text-danger">*</span>
                  </label>
                  <Input
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    placeholder="VD: Jean Tiêu Chuẩn Xuất Khẩu"
                    className="h-9 text-xs"
                    autoFocus
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-text pt-1">
                  <input
                    type="checkbox"
                    checked={newTemplateIsDedicated}
                    onChange={(e) => setNewTemplateIsDedicated(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span>Mẫu riêng biệt cho đơn đặt hàng đặc biệt (isDedicated)</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsNewTemplateModalOpen(false)}
                >
                  Huỷ
                </Button>
                <Button
                  size="sm"
                  disabled={!newTemplateName.trim() || createTemplateMutation.isPending}
                  onClick={() =>
                    createTemplateMutation.mutate({
                      name: newTemplateName.trim(),
                      isDedicated: newTemplateIsDedicated,
                    })
                  }
                >
                  {createTemplateMutation.isPending ? 'Đang tạo...' : 'Tạo mẫu quy trình'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Assign to Style Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md shadow-xl bg-surface border-border">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="font-semibold text-base text-text">Gán mẫu quy trình cho mã hàng</h3>
                <button
                  onClick={() => setIsAssignModalOpen(false)}
                  className="rounded p-1 text-text-muted hover:bg-background"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-text mb-1">
                    Quy trình đang chọn
                  </label>
                  <div className="rounded bg-background p-2 text-xs font-semibold text-text">
                    {activeTemplate?.name}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text mb-1">
                    Chọn mã hàng (Style) <span className="text-danger">*</span>
                  </label>
                  <select
                    value={selectedStyleId}
                    onChange={(e) => setSelectedStyleId(e.target.value)}
                    className="w-full h-9 rounded border border-border bg-background px-3 text-xs text-text focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {styles.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.styleCode} - {st.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button variant="outline" size="sm" onClick={() => setIsAssignModalOpen(false)}>
                  Huỷ
                </Button>
                <Button
                  size="sm"
                  disabled={!selectedStyleId || assignStyleMutation.isPending}
                  onClick={() => {
                    if (!activeTemplate) return;
                    assignStyleMutation.mutate({
                      styleId: selectedStyleId,
                      templateId: activeTemplate.id,
                    });
                  }}
                >
                  {assignStyleMutation.isPending ? 'Đang gán...' : 'Xác nhận gán'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
