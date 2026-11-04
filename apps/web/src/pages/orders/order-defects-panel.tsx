import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchOrderDefectsApi } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { i18n } from '../../lib/i18n/dictionary';

export function OrderDefectsPanel({
  orderId,
  token,
  onClose,
}: {
  orderId: string;
  token?: string | null;
  onClose: () => void;
}) {
  const {
    data = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['order-defects', orderId],
    queryFn: () => fetchOrderDefectsApi(orderId, token),
  });
  const t = i18n.orderDefects;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-text/30 p-6"
    >
      <section className="max-h-[80vh] w-full max-w-4xl overflow-auto rounded bg-surface p-6">
        <div className="flex justify-between">
          <h2>{t.title}</h2>
          <Button onClick={onClose}>{t.close}</Button>
        </div>
        {isLoading ? (
          <p>{i18n.common.loading}</p>
        ) : error ? (
          <p role="alert">{error.message}</p>
        ) : data.length === 0 ? (
          <p>{t.empty}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                {[t.step, t.bundle, t.type, t.qty, t.inspector].map((s) => (
                  <th key={s} className="p-2 text-left">
                    {s}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.id}>
                  <td className="p-2">
                    {d.stepName}
                    <small className="block">{d.stepCode}</small>
                  </td>
                  <td>{d.bundleCode ?? '—'}</td>
                  <td>{d.defectType}</td>
                  <td>{d.qty.toLocaleString('vi-VN')}</td>
                  <td>{d.inspectorName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
