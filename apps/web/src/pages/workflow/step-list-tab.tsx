import React, { useState } from 'react';
import {
  type ConditionAst,
  Role,
  StationType,
  StepType,
  type CreateStepDefinitionDto,
  type UpdateStepDefinitionDto,
} from '@denimflow/shared';
import { ArrowDown, ArrowUp, Edit2, Plus, ShieldAlert, Trash2, X } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import type { WorkflowStepItem } from '../../lib/api';
import { i18n } from '../../lib/i18n/dictionary';
import { ConditionBuilder } from './condition-builder';

interface StepListTabProps {
  steps: WorkflowStepItem[];
  isDraft: boolean;
  onAddStep: (dto: CreateStepDefinitionDto) => Promise<void>;
  onUpdateStep: (id: string, dto: UpdateStepDefinitionDto) => Promise<void>;
  onDeleteStep: (id: string) => Promise<void>;
}

export const StepListTab: React.FC<StepListTabProps> = ({
  steps,
  isDraft,
  onAddStep,
  onUpdateStep,
  onDeleteStep,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form states
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [stepType, setStepType] = useState<StepType>(StepType.PRODUCTION);
  const [seq, setSeq] = useState<number>(steps.length + 1);
  const [responsibleRole, setResponsibleRole] = useState<Role>(Role.STATION_OPERATOR);
  const [stationType, setStationType] = useState<StationType | ''>(StationType.SEWING);
  const [isMandatory, setIsMandatory] = useState(true);
  const [requiresEvidence, setRequiresEvidence] = useState(false);
  const [requiresQc, setRequiresQc] = useState(false);
  const [isStart, setIsStart] = useState(false);
  const [isEnd, setIsEnd] = useState(false);
  const [maxRework, setMaxRework] = useState<string>('');
  const [conditionExpr, setConditionExpr] = useState<ConditionAst | null>(null);

  const resetForm = () => {
    setCode('');
    setName('');
    setStepType(StepType.PRODUCTION);
    setSeq(steps.length + 1);
    setResponsibleRole(Role.STATION_OPERATOR);
    setStationType(StationType.SEWING);
    setIsMandatory(true);
    setRequiresEvidence(false);
    setRequiresQc(false);
    setIsStart(false);
    setIsEnd(false);
    setMaxRework('');
    setConditionExpr(null);
    setErrorMessage(null);
  };

  const startEdit = (step: WorkflowStepItem) => {
    setEditingStepId(step.id);
    setCode(step.code);
    setName(step.name);
    setStepType(step.stepType);
    setSeq(step.seq);
    setResponsibleRole(step.responsibleRole);
    setStationType(step.stationType || '');
    setIsMandatory(step.isMandatory);
    setRequiresEvidence(step.requiresEvidence);
    setRequiresQc(step.requiresQc);
    setIsStart(step.isStart);
    setIsEnd(step.isEnd);
    setMaxRework(step.maxRework ? String(step.maxRework) : '');
    setConditionExpr(step.conditionExpr);
    setIsAdding(false);
    setErrorMessage(null);
  };

  const cancelEdit = () => {
    setEditingStepId(null);
    setIsAdding(false);
    resetForm();
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      setErrorMessage('Vui lòng nhập đầy đủ mã và tên bước');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await onAddStep({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        stepType,
        seq: Number(seq),
        responsibleRole,
        stationType: stationType ? stationType : null,
        isMandatory,
        requiresEvidence,
        requiresQc,
        isStart,
        isEnd,
        maxRework: maxRework ? Number(maxRework) : null,
        conditionExpr,
      });
      setIsAdding(false);
      resetForm();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Không thể thêm bước quy trình');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStepId) return;

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await onUpdateStep(editingStepId, {
        name: name.trim(),
        stepType,
        seq: Number(seq),
        responsibleRole,
        stationType: stationType ? stationType : null,
        isMandatory,
        requiresEvidence,
        requiresQc,
        isStart,
        isEnd,
        maxRework: maxRework ? Number(maxRework) : null,
        conditionExpr,
      });
      setEditingStepId(null);
      resetForm();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Không thể cập nhật bước');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMoveStep = async (step: WorkflowStepItem, direction: 'up' | 'down') => {
    const currentIndex = steps.findIndex((s) => s.id === step.id);
    if (currentIndex === -1) return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= steps.length) return;

    const targetStep = steps[targetIndex];
    if (!targetStep) return;
    const originalSeq = step.seq;
    const newSeq = targetStep.seq;

    try {
      await onUpdateStep(step.id, { seq: newSeq });
      await onUpdateStep(targetStep.id, { seq: originalSeq });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Không thể thay đổi thứ tự bước');
    }
  };

  const sortedSteps = [...steps].sort((a, b) => a.seq - b.seq);

  return (
    <div className="space-y-4">
      {/* Top action header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text">Danh sách các bước trong quy trình</h3>
          <p className="text-xs text-text-muted">
            Quản lý các trạm, vai trò phụ trách và quy tắc thực hiện (BR-01, FR-04).
          </p>
        </div>

        {isDraft && !isAdding && !editingStepId && (
          <Button
            size="sm"
            onClick={() => {
              resetForm();
              setSeq(steps.length + 1);
              setIsAdding(true);
            }}
            className="flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            <span>Thêm bước mới</span>
          </Button>
        )}
      </div>

      {/* Add / Edit Form */}
      {(isAdding || editingStepId) && (
        <Card className="border-primary/50 bg-primary-tint/10">
          <CardContent className="pt-4">
            <form
              onSubmit={editingStepId ? handleUpdateSubmit : handleCreateSubmit}
              className="space-y-4"
            >
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="font-semibold text-sm text-text">
                  {editingStepId ? 'Chỉnh sửa bước quy trình' : 'Thêm bước mới vào quy trình'}
                </span>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="rounded p-1 text-text-muted hover:bg-background"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {errorMessage && (
                <div className="rounded bg-rose-50 p-2.5 text-xs text-danger border border-danger/20">
                  {errorMessage}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text mb-1">
                    Mã bước (Code) <span className="text-danger">*</span>
                  </label>
                  <Input
                    disabled={Boolean(editingStepId)}
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="VD: FABRIC_INSPECTION"
                    className="h-8 text-xs font-mono uppercase"
                    required
                  />
                  <span className="text-[10px] text-text-muted">Chữ in hoa, số và gạch dưới</span>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-text mb-1">
                    Tên bước <span className="text-danger">*</span>
                  </label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="VD: Kiểm tra vải đầu vào"
                    className="h-8 text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-text mb-1">Thứ tự (Seq)</label>
                  <Input
                    type="number"
                    min="1"
                    value={seq}
                    onChange={(e) => setSeq(Number(e.target.value))}
                    className="h-8 text-xs"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text mb-1">Loại bước</label>
                  <select
                    value={stepType}
                    onChange={(e) => setStepType(e.target.value as StepType)}
                    className="w-full h-8 rounded border border-border bg-surface px-2 text-xs text-text focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {Object.values(StepType).map((st) => (
                      <option key={st} value={st}>
                        {i18n.stepType[st] || st}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text mb-1">Trạm thực hiện</label>
                  <select
                    value={stationType}
                    onChange={(e) => setStationType(e.target.value as StationType | '')}
                    className="w-full h-8 rounded border border-border bg-surface px-2 text-xs text-text focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">(Không yêu cầu trạm)</option>
                    {Object.values(StationType).map((st) => (
                      <option key={st} value={st}>
                        {i18n.stationType[st] || st}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text mb-1">
                    Vai trò phụ trách
                  </label>
                  <select
                    value={responsibleRole}
                    onChange={(e) => setResponsibleRole(e.target.value as Role)}
                    className="w-full h-8 rounded border border-border bg-surface px-2 text-xs text-text focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {Object.values(Role).map((r) => (
                      <option key={r} value={r}>
                        {i18n.roles[r] || r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Flags */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded bg-surface p-3 border border-border">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-text">
                  <input
                    type="checkbox"
                    checked={isStart}
                    onChange={(e) => setIsStart(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span>Bước bắt đầu (Start)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-text">
                  <input
                    type="checkbox"
                    checked={isEnd}
                    onChange={(e) => setIsEnd(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span>Bước kết thúc (End)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-text">
                  <input
                    type="checkbox"
                    checked={isMandatory}
                    onChange={(e) => setIsMandatory(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span>Bắt buộc thực hiện</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-text">
                  <input
                    type="checkbox"
                    checked={requiresEvidence}
                    onChange={(e) => setRequiresEvidence(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span>Cần ảnh minh chứng</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-text">
                  <input
                    type="checkbox"
                    checked={requiresQc}
                    onChange={(e) => setRequiresQc(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span>Yêu cầu nghiệm thu QC</span>
                </label>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-text whitespace-nowrap">Làm lại tối đa:</span>
                  <Input
                    type="number"
                    min="1"
                    value={maxRework}
                    onChange={(e) => setMaxRework(e.target.value)}
                    placeholder="Không giới hạn"
                    className="h-7 w-24 text-xs"
                  />
                </div>
              </div>

              {/* Condition builder */}
              <ConditionBuilder
                value={conditionExpr}
                onChange={setConditionExpr}
                disabled={!isDraft}
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={cancelEdit}>
                  Huỷ
                </Button>
                <Button type="submit" size="sm" disabled={isSubmitting}>
                  {isSubmitting ? 'Đang lưu...' : editingStepId ? 'Cập nhật bước' : 'Thêm bước'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Step Table */}
      <div className="rounded border border-border bg-surface overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-background text-text-muted border-b border-border uppercase text-[11px] font-semibold">
            <tr>
              <th className="py-2.5 px-3 w-14 text-center">Seq</th>
              <th className="py-2.5 px-3">Mã bước</th>
              <th className="py-2.5 px-3">Tên bước</th>
              <th className="py-2.5 px-3">Loại & Trạm</th>
              <th className="py-2.5 px-3">Vai trò phụ trách</th>
              <th className="py-2.5 px-3">Quy tắc</th>
              {isDraft && <th className="py-2.5 px-3 text-right w-28">Thao tác</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sortedSteps.length === 0 ? (
              <tr>
                <td colSpan={isDraft ? 7 : 6} className="py-8 text-center text-text-muted">
                  Chưa có bước nào trong phiên bản quy trình này. Hãy thêm bước đầu tiên!
                </td>
              </tr>
            ) : (
              sortedSteps.map((step, idx) => (
                <tr key={step.id} className="hover:bg-background/50 transition-colors">
                  <td className="py-2.5 px-3 text-center">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary-tint text-[11px] font-bold text-primary">
                      {step.seq}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono font-medium text-text">
                    <div className="flex items-center gap-1.5">
                      <span>{step.code}</span>
                      {step.isStart && (
                        <Badge tone="success" className="text-[10px] py-0 px-1">
                          Start
                        </Badge>
                      )}
                      {step.isEnd && (
                        <Badge tone="neutral" className="text-[10px] py-0 px-1">
                          End
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 font-medium text-text">{step.name}</td>
                  <td className="py-2.5 px-3 text-text-muted">
                    <div>{i18n.stepType[step.stepType] || step.stepType}</div>
                    <div className="text-[11px] text-text font-medium">
                      {step.stationType ? i18n.stationType[step.stationType] : '—'}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-text">
                    {i18n.roles[step.responsibleRole] || step.responsibleRole}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex flex-wrap gap-1">
                      {step.isMandatory && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-700">
                          Bắt buộc
                        </span>
                      )}
                      {step.requiresEvidence && (
                        <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] text-sky-700 font-medium">
                          Ảnh minh chứng
                        </span>
                      )}
                      {step.requiresQc && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800 font-medium flex items-center gap-0.5">
                          <ShieldAlert className="h-2.5 w-2.5" /> QC
                        </span>
                      )}
                      {step.maxRework !== null && step.maxRework !== undefined && (
                        <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] text-rose-800 font-medium">
                          Max Rework: {step.maxRework}
                        </span>
                      )}
                      {step.conditionExpr && (
                        <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] text-indigo-800 font-medium">
                          Có điều kiện
                        </span>
                      )}
                    </div>
                  </td>
                  {isDraft && (
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          disabled={idx === 0}
                          onClick={() => handleMoveStep(step, 'up')}
                          title="Di chuyển lên"
                          className="rounded p-1 text-text-muted hover:bg-background disabled:opacity-30"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          disabled={idx === sortedSteps.length - 1}
                          onClick={() => handleMoveStep(step, 'down')}
                          title="Di chuyển xuống"
                          className="rounded p-1 text-text-muted hover:bg-background disabled:opacity-30"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => startEdit(step)}
                          title="Sửa bước"
                          className="rounded p-1 text-primary hover:bg-primary-tint"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Xoá bước "${step.name}" (${step.code})?`)) {
                              onDeleteStep(step.id);
                            }
                          }}
                          title="Xoá bước"
                          className="rounded p-1 text-danger hover:bg-rose-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
