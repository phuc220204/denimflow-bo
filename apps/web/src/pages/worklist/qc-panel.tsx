import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Plus, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  evaluateQcApi,
  fetchQcInspectionsApi,
  fetchQuantityPanelApi,
  recordQcInspectionApi,
  type QcEvaluationDto,
  type QcEvaluationInputDto,
} from '../../lib/api';

interface QcPanelProps {
  stepId: string;
  token: string | null | undefined;
  // In-line QC of a quantity step lets defects name a bundle of the order.
  withBundles: boolean;
  onPassed: (message: string) => void;
}

interface DefectRow {
  defectType: string;
  qty: number;
  bundleId?: string;
}

const RESULT_LABEL = { PASS: 'Đạt', REWORK: 'Làm lại', REJECT: 'Loại' } as const;
const PROFILE_LABEL = {
  FULL_PROCESS: 'Quy trình đầy đủ',
  SKIP_CLEAN_WASH: 'Bỏ giặt sạch',
} as const;

// FR-16: the inspector enters measurements, previews the proposal from the order's QC Profile
// (BR-19) and confirms. Only PASS can be recorded until rework routing (T5.2) ships.
export const QcPanel: React.FC<QcPanelProps> = ({ stepId, token, withBundles, onPassed }) => {
  const queryClient = useQueryClient();
  const [sampleSize, setSampleSize] = useState('');
  const [shrinkage, setShrinkage] = useState('');
  const [fading, setFading] = useState('');
  const [notes, setNotes] = useState('');
  const [defects, setDefects] = useState<DefectRow[]>([]);
  const [newDefect, setNewDefect] = useState<DefectRow>({ defectType: '', qty: 1 });
  const [evaluation, setEvaluation] = useState<QcEvaluationDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: history = [] } = useQuery({
    queryKey: ['qc-inspections', stepId],
    queryFn: () => fetchQcInspectionsApi(stepId, token),
  });
  const { data: quantityPanel } = useQuery({
    queryKey: ['quantities', stepId],
    queryFn: () => fetchQuantityPanelApi(stepId, token),
    enabled: withBundles,
  });
  const bundles = quantityPanel?.bundles ?? [];

  // Any change to the inputs invalidates the previewed proposal.
  const touch =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setEvaluation(null);
    };

  const input = (): QcEvaluationInputDto => ({
    sampleSize: Number(sampleSize),
    measuredShrinkagePercent: shrinkage === '' ? null : Number(shrinkage),
    measuredColorFadingLevel: fading === '' ? null : Number(fading),
    defects: defects.map((d) => ({
      defectType: d.defectType,
      qty: d.qty,
      ...(d.bundleId ? { bundleId: d.bundleId } : {}),
    })),
  });

  const evaluateMutation = useMutation({
    mutationFn: () => evaluateQcApi(stepId, input(), token),
    onSuccess: (data) => {
      setEvaluation(data);
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const passMutation = useMutation({
    mutationFn: () =>
      recordQcInspectionApi(
        stepId,
        { ...input(), result: 'PASS', ...(notes.trim() ? { notes: notes.trim() } : {}) },
        token,
      ),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['worklist'] });
      void queryClient.invalidateQueries({ queryKey: ['qc-inspections', stepId] });
      const next = data.newlyReadyStepCodes.length
        ? ` Công đoạn tiếp theo [${data.newlyReadyStepCodes.join(', ')}] đã sẵn sàng.`
        : '';
      onPassed(`Đã ghi nhận kết quả QC: Đạt.${next}`);
    },
    onError: (err: Error) => setError(err.message),
  });

  const addDefect = () => {
    if (!newDefect.defectType.trim() || newDefect.qty < 1) {
      return;
    }
    touch(setDefects)([...defects, { ...newDefect, defectType: newDefect.defectType.trim() }]);
    setNewDefect({ defectType: '', qty: 1 });
  };

  const canEvaluate = Number(sampleSize) >= 1;

  return (
    <div className="space-y-3 border-t border-border pt-3 text-xs" aria-label="Kiểm tra QC">
      <div className="grid grid-cols-3 gap-2">
        <Input
          label="Cỡ mẫu"
          id={`qc-sample-${stepId}`}
          type="number"
          min={1}
          value={sampleSize}
          onChange={(e) => touch(setSampleSize)(e.target.value)}
        />
        <Input
          label="Độ co (%)"
          id={`qc-shrinkage-${stepId}`}
          type="number"
          min={0}
          max={100}
          step={0.01}
          value={shrinkage}
          onChange={(e) => touch(setShrinkage)(e.target.value)}
          helperText="Để trống nếu không đo"
        />
        <label className="space-y-1">
          <span className="block text-sm font-medium text-text">Mức phai màu</span>
          <select
            aria-label="Mức phai màu"
            value={fading}
            onChange={(e) => touch(setFading)(e.target.value)}
            className="h-9 w-full rounded border border-border px-2"
          >
            <option value="">Không đo</option>
            {[0, 1, 2, 3, 4, 5].map((level) => (
              <option key={level} value={String(level)}>
                {level}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-2">
        <span className="block text-sm font-medium text-text">Lỗi phát hiện</span>
        {defects.map((defect, index) => (
          <div key={index} className="flex items-center justify-between gap-2 tabular-nums">
            <span>
              {defect.defectType}: {defect.qty}
              {defect.bundleId &&
                ` (bó ${bundles.find((b) => b.id === defect.bundleId)?.bundleCode ?? ''})`}
            </span>
            <Button
              variant="outline"
              size="sm"
              aria-label="Xoá lỗi"
              onClick={() => touch(setDefects)(defects.filter((_, i) => i !== index))}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <div className="flex flex-wrap items-end gap-2">
          <Input
            label="Loại lỗi"
            id={`qc-defect-type-${stepId}`}
            value={newDefect.defectType}
            onChange={(e) => setNewDefect({ ...newDefect, defectType: e.target.value })}
          />
          <Input
            label="Số lượng lỗi"
            id={`qc-defect-qty-${stepId}`}
            type="number"
            min={1}
            value={newDefect.qty}
            onChange={(e) => setNewDefect({ ...newDefect, qty: Number(e.target.value) })}
          />
          {withBundles && bundles.length > 0 && (
            <select
              aria-label="Bó"
              value={newDefect.bundleId ?? ''}
              onChange={(e) =>
                setNewDefect({ ...newDefect, bundleId: e.target.value || undefined })
              }
              className="h-9 rounded border border-border px-2"
            >
              <option value="">Không chọn bó</option>
              {bundles.map((bundle) => (
                <option key={bundle.id} value={bundle.id}>
                  {bundle.bundleCode}
                </option>
              ))}
            </select>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={addDefect}
            className="flex items-center gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            Thêm lỗi
          </Button>
        </div>
      </div>

      <Input
        label="Ghi chú"
        id={`qc-notes-${stepId}`}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      <Button
        size="sm"
        variant="outline"
        className="w-full"
        disabled={!canEvaluate || evaluateMutation.isPending}
        onClick={() => evaluateMutation.mutate()}
      >
        Xem đề xuất
      </Button>

      {evaluation && (
        <div className="space-y-1 rounded border border-border p-2">
          <div className="flex items-center gap-2">
            <span>Đề xuất theo Hồ sơ QC ({PROFILE_LABEL[evaluation.profileType]}):</span>
            <Badge tone={evaluation.proposedResult === 'PASS' ? 'success' : 'warning'}>
              {RESULT_LABEL[evaluation.proposedResult]}
            </Badge>
          </div>
          {evaluation.criteria.map((criterion) => (
            <p
              key={criterion.criterion}
              className={criterion.passed ? 'text-text' : 'text-danger-text'}
            >
              {criterion.reason}
            </p>
          ))}
          <p className="tabular-nums text-text-muted">
            Tỷ lệ lỗi: {evaluation.defectRatePercent}% ({evaluation.totalDefectQty}/{sampleSize})
          </p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <Button
          size="sm"
          disabled={evaluation?.proposedResult !== 'PASS' || passMutation.isPending}
          onClick={() => passMutation.mutate()}
        >
          Xác nhận Đạt
        </Button>
        <Button size="sm" variant="outline" disabled>
          Làm lại
        </Button>
        <Button size="sm" variant="outline" disabled>
          Loại
        </Button>
      </div>
      <p className="text-text-muted">Làm lại / Loại sẽ có khi bổ sung định tuyến làm lại (T5.2).</p>

      {error && (
        <div className="flex items-center gap-1.5 rounded bg-danger-tint p-2 text-danger-text">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {history.length > 0 && (
        <ul className="divide-y divide-border">
          {history.map((inspection) => (
            <li
              key={inspection.id}
              className="flex items-center justify-between py-1.5 tabular-nums"
            >
              <span>
                {new Date(inspection.createdAt).toLocaleString('vi-VN')}: cỡ mẫu{' '}
                {inspection.sampleSize}
                {inspection.defects.length > 0 &&
                  `, ${inspection.defects.reduce((sum, d) => sum + d.qty, 0)} lỗi`}
              </span>
              <Badge tone={inspection.result === 'PASS' ? 'success' : 'warning'}>
                {RESULT_LABEL[inspection.result]}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
