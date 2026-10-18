import React, { useState } from 'react';
import { TransitionKind, type ConditionAst, type CreateStepTransitionDto } from '@denimflow/shared';
import { ArrowRight, Plus, Trash2, X } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import type { WorkflowStepItem, WorkflowTransitionItem } from '../../lib/api';
import { i18n } from '../../lib/i18n/dictionary';
import { ConditionBuilder } from './condition-builder';

interface TransitionsTabProps {
  steps: WorkflowStepItem[];
  transitions: WorkflowTransitionItem[];
  isDraft: boolean;
  onAddTransition: (dto: CreateStepTransitionDto) => Promise<void>;
  onDeleteTransition: (id: string) => Promise<void>;
}

export const TransitionsTab: React.FC<TransitionsTabProps> = ({
  steps,
  transitions,
  isDraft,
  onAddTransition,
  onDeleteTransition,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [fromStepId, setFromStepId] = useState<string>(steps[0]?.id || '');
  const [toStepId, setToStepId] = useState<string>(steps[1]?.id || steps[0]?.id || '');
  const [kind, setKind] = useState<TransitionKind>(TransitionKind.NORMAL);
  const [conditionExpr, setConditionExpr] = useState<ConditionAst | null>(null);

  const resetForm = () => {
    setFromStepId(steps[0]?.id || '');
    setToStepId(steps[1]?.id || steps[0]?.id || '');
    setKind(TransitionKind.NORMAL);
    setConditionExpr(null);
    setErrorMessage(null);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromStepId || !toStepId) {
      setErrorMessage('Vui lòng chọn bước nguồn và bước đích');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await onAddTransition({
        fromStepId,
        toStepId,
        kind,
        conditionExpr,
      });
      setIsAdding(false);
      resetForm();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Không thể tạo chuyển tiếp');
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepMap = new Map(steps.map((s) => [s.id, s]));

  return (
    <div className="space-y-4">
      {/* Top action header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text">
            Chuyển tiếp giữa các bước (Transitions)
          </h3>
          <p className="text-xs text-text-muted">
            Xác lập đường đi tuần tự (NORMAL) hoặc đường rẽ nhánh/làm lại (REWORK) kèm điều kiện rẽ
            nhánh (BR-01, FR-04).
          </p>
        </div>

        {isDraft && !isAdding && steps.length >= 2 && (
          <Button
            size="sm"
            onClick={() => {
              resetForm();
              setIsAdding(true);
            }}
            className="flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            <span>Thêm chuyển tiếp</span>
          </Button>
        )}
      </div>

      {/* Add Transition Form */}
      {isAdding && (
        <Card className="border-primary/50 bg-primary-tint/10">
          <CardContent className="pt-4">
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="font-semibold text-sm text-text">Thêm chuyển tiếp mới</span>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text mb-1">
                    Bước bắt đầu (Từ) <span className="text-danger">*</span>
                  </label>
                  <select
                    value={fromStepId}
                    onChange={(e) => setFromStepId(e.target.value)}
                    className="w-full h-8 rounded border border-border bg-surface px-2 text-xs text-text focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  >
                    {steps.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.seq}. {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text mb-1">
                    Bước tiếp theo (Đến) <span className="text-danger">*</span>
                  </label>
                  <select
                    value={toStepId}
                    onChange={(e) => setToStepId(e.target.value)}
                    className="w-full h-8 rounded border border-border bg-surface px-2 text-xs text-text focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  >
                    {steps.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.seq}. {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text mb-1">
                    Loại chuyển tiếp
                  </label>
                  <select
                    value={kind}
                    onChange={(e) => setKind(e.target.value as TransitionKind)}
                    className="w-full h-8 rounded border border-border bg-surface px-2 text-xs text-text focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value={TransitionKind.NORMAL}>
                      {i18n.transitionKind[TransitionKind.NORMAL]} (Tuần tự tiến tới)
                    </option>
                    <option value={TransitionKind.REWORK}>
                      {i18n.transitionKind[TransitionKind.REWORK]} (Làm lại / Sửa chữa)
                    </option>
                  </select>
                </div>
              </div>

              {/* Condition builder */}
              <ConditionBuilder
                value={conditionExpr}
                onChange={setConditionExpr}
                disabled={!isDraft}
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAdding(false)}
                >
                  Huỷ
                </Button>
                <Button type="submit" size="sm" disabled={isSubmitting}>
                  {isSubmitting ? 'Đang tạo...' : 'Lưu chuyển tiếp'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Transitions Table */}
      <div className="rounded border border-border bg-surface overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-background text-text-muted border-b border-border uppercase text-[11px] font-semibold">
            <tr>
              <th className="py-2.5 px-3">Từ bước nguồn</th>
              <th className="py-2.5 px-3 w-8 text-center"></th>
              <th className="py-2.5 px-3">Đến bước đích</th>
              <th className="py-2.5 px-3">Loại</th>
              <th className="py-2.5 px-3">Điều kiện rẽ nhánh</th>
              {isDraft && <th className="py-2.5 px-3 text-right w-20">Thao tác</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {transitions.length === 0 ? (
              <tr>
                <td colSpan={isDraft ? 6 : 5} className="py-8 text-center text-text-muted">
                  Chưa có chuyển tiếp nào được thiết lập.
                </td>
              </tr>
            ) : (
              transitions.map((t) => {
                const fromStep = stepMap.get(t.fromStepId);
                const toStep = stepMap.get(t.toStepId);
                const isRework = t.kind === TransitionKind.REWORK;

                return (
                  <tr key={t.id} className="hover:bg-background/50 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-text">
                        {fromStep ? `${fromStep.seq}. ${fromStep.name}` : t.fromStepId}
                      </div>
                      <div className="font-mono text-[11px] text-text-muted">{fromStep?.code}</div>
                    </td>

                    <td className="py-2.5 px-3 text-center text-text-muted">
                      <ArrowRight className="h-4 w-4 mx-auto" />
                    </td>

                    <td className="py-2.5 px-3">
                      <div className="font-medium text-text">
                        {toStep ? `${toStep.seq}. ${toStep.name}` : t.toStepId}
                      </div>
                      <div className="font-mono text-[11px] text-text-muted">{toStep?.code}</div>
                    </td>

                    <td className="py-2.5 px-3">
                      {isRework ? (
                        <Badge tone="danger" className="text-[11px]">
                          Làm lại (REWORK)
                        </Badge>
                      ) : (
                        <Badge tone="info" className="text-[11px]">
                          Chính thức (NORMAL)
                        </Badge>
                      )}
                    </td>

                    <td className="py-2.5 px-3">
                      {t.conditionExpr ? (
                        <code className="rounded bg-background px-1.5 py-0.5 text-[11px] font-mono text-primary border border-border">
                          {JSON.stringify(t.conditionExpr)}
                        </code>
                      ) : (
                        <span className="text-text-muted text-[11px]">Không có (Luôn chuyển)</span>
                      )}
                    </td>

                    {isDraft && (
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => {
                            if (window.confirm('Xác nhận xoá chuyển tiếp này?')) {
                              onDeleteTransition(t.id);
                            }
                          }}
                          title="Xoá chuyển tiếp"
                          className="rounded p-1 text-danger hover:bg-rose-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
