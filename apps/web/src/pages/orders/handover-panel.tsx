import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createHandoverApi, fetchHandoverApi } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { i18n } from '../../lib/i18n/dictionary';
export function HandoverPanel({
  orderId,
  token,
  canCreate,
  onClose,
}: {
  orderId: string;
  token?: string | null;
  canCreate: boolean;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState('');
  const client = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['handover', orderId],
    queryFn: () => fetchHandoverApi(orderId, token),
  });
  const create = useMutation({
    mutationFn: () => createHandoverApi(orderId, { notes }, token),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['handover', orderId] });
      void client.invalidateQueries({ queryKey: ['orders'] });
    },
  });
  const t = i18n.handover;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-text/30 p-6"
    >
      <section className="max-h-[80vh] w-full max-w-3xl overflow-auto rounded bg-surface p-6">
        <div className="flex justify-between">
          <h2>{t.title}</h2>
          <Button onClick={onClose}>{t.close}</Button>
        </div>
        {isLoading ? (
          <p>{i18n.common.loading}</p>
        ) : error ? (
          <p role="alert">{error.message}</p>
        ) : data ? (
          <>
            <p>
              {data.orderNumber} — {data.qcProfileType}
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>{t.size}</th>
                  <th>{t.planned}</th>
                  <th>{t.actual}</th>
                </tr>
              </thead>
              <tbody>
                {data.packingList.map((line) => (
                  <tr key={line.size}>
                    <td>{line.size}</td>
                    <td>{line.plannedQty}</td>
                    <td>{line.actualQty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>
              {t.total}: {data.totalQty}
            </p>
            <p>
              {data.handedOverByName} — {new Date(data.handedOverAt).toLocaleString('vi-VN')}
            </p>
          </>
        ) : (
          <>
            <p>{t.requirement}</p>
            {canCreate && (
              <>
                <label>
                  {t.notes}
                  <textarea
                    className="block w-full rounded border border-border"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>
                <Button
                  disabled={create.isPending}
                  onClick={() => {
                    if (window.confirm(t.confirm)) create.mutate();
                  }}
                >
                  {t.create}
                </Button>
              </>
            )}
          </>
        )}
        {create.error && <p role="alert">{create.error.message}</p>}
      </section>
    </div>
  );
}
