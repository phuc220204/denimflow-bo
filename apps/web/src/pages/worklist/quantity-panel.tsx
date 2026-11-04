import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, RotateCcw } from 'lucide-react';
import React, { useState } from 'react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  fetchQuantityPanelApi,
  recordQuantityApi,
  reverseQuantityApi,
  type RecordQuantityEntryDto,
  type StepQuantityEntryDto,
} from '../../lib/api';

interface QuantityPanelProps {
  stepId: string;
  token: string | null | undefined;
  canEdit: boolean;
}

const toCount = (value: FormDataEntryValue | null) => Number(value || 0);

// FR-13: quantity entry for one step. Cutting counts per size (BR-07), later steps per bundle
// (BR-08), outsourced stations add sent/received (BR-09). The API re-checks every rule.
export const QuantityPanel: React.FC<QuantityPanelProps> = ({ stepId, token, canEdit }) => {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [reversingId, setReversingId] = useState<string | null>(null);
  const [reverseReason, setReverseReason] = useState('');

  const { data: panel, isLoading } = useQuery({
    queryKey: ['quantities', stepId],
    queryFn: () => fetchQuantityPanelApi(stepId, token),
  });

  const refresh = () => {
    setError(null);
    void queryClient.invalidateQueries({ queryKey: ['quantities', stepId] });
    void queryClient.invalidateQueries({ queryKey: ['worklist'] });
  };

  const recordMutation = useMutation({
    mutationFn: (body: RecordQuantityEntryDto) => recordQuantityApi(stepId, body, token),
    onSuccess: refresh,
    onError: (err: Error) => setError(err.message),
  });

  const reverseMutation = useMutation({
    mutationFn: ({ entryId, reason }: { entryId: string; reason: string }) =>
      reverseQuantityApi(stepId, entryId, reason, token),
    onSuccess: () => {
      setReversingId(null);
      setReverseReason('');
      refresh();
    },
    onError: (err: Error) => setError(err.message),
  });

  if (isLoading || !panel) {
    return <p className="text-xs text-text-muted">Đang tải số lượng...</p>;
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const scope =
      panel.mode === 'CUTTING'
        ? { size: String(data.get('size')) }
        : { bundleId: String(data.get('bundleId')) };
    const body: RecordQuantityEntryDto = {
      ...scope,
      qtyGood: toCount(data.get('qtyGood')),
      qtyDefect: toCount(data.get('qtyDefect')),
      ...(panel.isOutsourced
        ? {
            qtySent: toCount(data.get('qtySent')),
            qtyReceived: toCount(data.get('qtyReceived')),
            mismatchReason: String(data.get('mismatchReason') || '') || undefined,
          }
        : {}),
      note: String(data.get('note') || '') || undefined,
    };
    recordMutation.mutate(body, { onSuccess: () => form.reset() });
  };

  const scopeLabel = (entry: StepQuantityEntryDto) =>
    entry.size ? `Size ${entry.size}` : `Bó ${entry.bundleCode ?? ''}`;

  return (
    <div className="space-y-3 border-t border-border pt-3 text-xs">
      <div className="flex flex-wrap gap-x-4 gap-y-1 tabular-nums text-text">
        {panel.previousGood !== null && (
          <span>
            Đã nhận: <strong>{panel.qtyIn}</strong> / {panel.previousGood}
          </span>
        )}
        <span>
          Số lượng đạt: <strong>{panel.qtyGood}</strong>
        </span>
        <span>
          Số lượng lỗi: <strong>{panel.qtyDefect}</strong>
        </span>
      </div>

      {panel.mode === 'CUTTING' && (
        <table className="w-full text-left tabular-nums">
          <thead className="text-text-muted">
            <tr>
              <th className="py-1">Size</th>
              <th className="py-1 text-right">Kế hoạch</th>
              <th className="py-1 text-right">Tối đa</th>
              <th className="py-1 text-right">Đã cắt</th>
            </tr>
          </thead>
          <tbody>
            {panel.sizes.map((line) => (
              <tr key={line.size}>
                <td className="py-1 font-mono">{line.size}</td>
                <td className="py-1 text-right">{line.plannedQty}</td>
                <td className="py-1 text-right">{line.maxQty}</td>
                <td className="py-1 text-right">{line.cutQty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {canEdit && panel.status === 'IN_PROGRESS' && (
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-2" aria-label="Nhập số lượng">
          <label className="col-span-2 space-y-1">
            <span className="block font-medium text-text">
              {panel.mode === 'CUTTING' ? 'Size' : 'Bó'}
            </span>
            {panel.mode === 'CUTTING' ? (
              <select name="size" required className="h-9 w-full rounded border border-border px-2">
                {panel.sizes.map((line) => (
                  <option key={line.size} value={line.size}>
                    {line.size}
                  </option>
                ))}
              </select>
            ) : (
              <select
                name="bundleId"
                required
                className="h-9 w-full rounded border border-border px-2"
              >
                {panel.bundles.map((bundle) => (
                  <option key={bundle.id} value={bundle.id}>
                    {bundle.bundleCode} (size {bundle.size}, còn{' '}
                    {bundle.availableQty - bundle.takenQty})
                  </option>
                ))}
              </select>
            )}
          </label>
          <Input
            label="Số lượng đạt"
            id={`qtyGood-${stepId}`}
            name="qtyGood"
            type="number"
            min={0}
            required
          />
          <Input
            label="Số lượng lỗi"
            id={`qtyDefect-${stepId}`}
            name="qtyDefect"
            type="number"
            min={0}
            defaultValue={0}
          />
          {panel.isOutsourced && (
            <>
              <Input
                label="Số gửi đi"
                id={`qtySent-${stepId}`}
                name="qtySent"
                type="number"
                min={0}
                required
              />
              <Input
                label="Số nhận về"
                id={`qtyReceived-${stepId}`}
                name="qtyReceived"
                type="number"
                min={0}
                required
              />
              <div className="col-span-2">
                <Input
                  label="Lý do chênh lệch"
                  id={`mismatchReason-${stepId}`}
                  name="mismatchReason"
                  helperText="Bắt buộc khi số nhận về khác số gửi đi (BR-09)."
                />
              </div>
            </>
          )}
          <div className="col-span-2">
            <Input label="Ghi chú" id={`note-${stepId}`} name="note" />
          </div>
          <Button
            type="submit"
            size="sm"
            className="col-span-2"
            disabled={recordMutation.isPending}
          >
            Ghi nhận số lượng
          </Button>
        </form>
      )}

      {error && (
        <div className="flex items-center gap-1.5 rounded bg-danger-tint p-2 text-danger-text">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {panel.entries.length > 0 && (
        <ul className="divide-y divide-border">
          {panel.entries.map((entry) => (
            <li key={entry.id} className="py-1.5 space-y-1">
              <div
                className={`flex items-center justify-between gap-2 tabular-nums ${
                  entry.isReversed || entry.reversesEntryId ? 'text-text-muted' : 'text-text'
                }`}
              >
                <span className={entry.isReversed ? 'line-through' : ''}>
                  {scopeLabel(entry)}: đạt {entry.qtyGood}, lỗi {entry.qtyDefect}
                  {entry.qtySent !== null && ` (gửi ${entry.qtySent}, nhận ${entry.qtyReceived})`}
                  {entry.reversesEntryId && ` — huỷ dòng: ${entry.note ?? ''}`}
                </span>
                {canEdit &&
                  panel.status === 'IN_PROGRESS' &&
                  !entry.isReversed &&
                  !entry.reversesEntryId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setReversingId(entry.id)}
                      className="flex items-center gap-1"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Huỷ dòng
                    </Button>
                  )}
              </div>
              {reversingId === entry.id && (
                <div className="flex items-end gap-2">
                  <Input
                    label="Lý do huỷ"
                    id={`reverse-${entry.id}`}
                    value={reverseReason}
                    onChange={(e) => setReverseReason(e.target.value)}
                  />
                  <Button
                    size="sm"
                    disabled={!reverseReason.trim() || reverseMutation.isPending}
                    onClick={() =>
                      reverseMutation.mutate({ entryId: entry.id, reason: reverseReason.trim() })
                    }
                  >
                    Xác nhận
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
