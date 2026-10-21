import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { AlertCircle, Eye, History, RefreshCw, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { auditLogQuerySchema } from '@denimflow/shared';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { type AuditLogItemDto, fetchAuditFilterOptionsApi, fetchAuditLogsApi } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { i18n } from '../../lib/i18n/dictionary';

const t = i18n.audit;
const PAGE_SIZE = 20;
const numberFormat = new Intl.NumberFormat('vi-VN');
const entityIdSchema = auditLogQuerySchema.shape.entityId;

const selectClassName =
  'h-9 w-full rounded border border-border bg-surface px-3 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

export function entityTypeLabel(entityType: string): string {
  return t.entityTypes[entityType.toLowerCase().replaceAll('_', '')] ?? entityType;
}

// dd/MM/yyyy HH:mm:ss in the browser's time zone (DESIGN.md formats, with seconds for audit).
function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// <input type="date"> gives yyyy-MM-dd; the API takes inclusive ISO bounds, so the picked days
// are widened to the start and end of the local day.
function startOfLocalDay(date: string): string {
  return new Date(`${date}T00:00:00`).toISOString();
}
function endOfLocalDay(date: string): string {
  return new Date(`${date}T23:59:59.999`).toISOString();
}

interface DiffRow {
  key: string;
  before: unknown;
  after: unknown;
  changed: boolean;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Field-by-field comparison when both sides are objects (or missing); null means "show raw JSON".
export function diffAuditValues(oldValue: unknown, newValue: unknown): DiffRow[] | null {
  if (
    (oldValue != null && !isPlainObject(oldValue)) ||
    (newValue != null && !isPlainObject(newValue))
  ) {
    return null;
  }
  const before = isPlainObject(oldValue) ? oldValue : {};
  const after = isPlainObject(newValue) ? newValue : {};
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  return keys.map((key) => ({
    key,
    before: before[key],
    after: after[key],
    changed: JSON.stringify(before[key]) !== JSON.stringify(after[key]),
  }));
}

const DiffValue: React.FC<{ value: unknown }> = ({ value }) => {
  if (value === undefined) return <span className="text-text-muted">—</span>;
  return (
    <span className="break-all font-mono text-xs">
      {typeof value === 'string' ? value : JSON.stringify(value)}
    </span>
  );
};

const AuditDetailDialog: React.FC<{ log: AuditLogItemDto; onClose: () => void }> = ({
  log,
  onClose,
}) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  const rows = diffAuditValues(log.oldValue, log.newValue);

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="audit-detail-title"
        className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded border border-border bg-surface shadow-lg"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
          <div>
            <h2 id="audit-detail-title" className="text-base font-semibold text-text">
              {t.detailTitle} #{log.id}
            </h2>
            <p className="mt-1 text-xs text-text-muted">
              <span className="font-mono">{log.action}</span> · {entityTypeLabel(log.entityType)}{' '}
              <span className="font-mono">{log.entityId}</span>
            </p>
            <p className="text-xs text-text-muted">
              {formatDateTime(log.createdAt)} ·{' '}
              {log.actorName ? `${log.actorName} (${log.actorEmail})` : t.systemActor}
            </p>
          </div>
          <Button
            ref={closeRef}
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={t.close}
            className="shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4 overflow-y-auto p-4 text-sm">
          {rows === null ? null : rows.length === 0 ? (
            <p className="text-text-muted">{t.noChanges}</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-text-muted">
                <tr>
                  <th className="py-2 pr-3 font-medium">{t.field}</th>
                  <th className="py-2 pr-3 font-medium">{t.before}</th>
                  <th className="py-2 pr-3 font-medium">{t.after}</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr key={row.key} className={row.changed ? 'text-text' : 'text-text-muted'}>
                    <td className="py-2 pr-3 align-top font-mono text-xs">{row.key}</td>
                    <td className="py-2 pr-3 align-top">
                      <DiffValue value={row.before} />
                    </td>
                    <td className="py-2 pr-3 align-top">
                      <DiffValue value={row.after} />
                    </td>
                    <td className="py-2 align-top">
                      {row.changed && <Badge tone="warning">{t.changed}</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <details open={rows === null}>
            <summary className="cursor-pointer text-sm font-medium text-primary">
              {t.rawJson}
            </summary>
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              {[
                { label: `${t.before} (old_value)`, value: log.oldValue },
                { label: `${t.after} (new_value)`, value: log.newValue },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="mb-1 text-xs font-medium text-text-muted">{label}</p>
                  <pre className="max-h-64 overflow-auto rounded border border-border bg-background p-3 font-mono text-xs text-text">
                    {JSON.stringify(value, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </details>
        </div>

        <div className="flex justify-end border-t border-border px-4 py-3">
          <Button variant="outline" size="sm" onClick={onClose}>
            {t.close}
          </Button>
        </div>
      </div>
    </div>
  );
};

export const AuditPage: React.FC = () => {
  const { token } = useAuth();

  const [entityType, setEntityType] = useState('');
  const [entityId, setEntityId] = useState('');
  const [actorId, setActorId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AuditLogItemDto | null>(null);
  // Stable, so the dialog does not re-run its focus/keyboard effect on every refetch.
  const closeDetail = useCallback(() => setSelectedLog(null), []);

  // Pre-checks for a better message only; the API validates the query again (422).
  const trimmedEntityId = entityId.trim();
  const entityIdInvalid =
    trimmedEntityId !== '' && !entityIdSchema.safeParse(trimmedEntityId).success;
  const dateRangeInvalid = fromDate !== '' && toDate !== '' && fromDate > toDate;

  const query = {
    entityType: entityType || undefined,
    entityId: trimmedEntityId && !entityIdInvalid ? trimmedEntityId : undefined,
    actorId: actorId || undefined,
    from: fromDate ? startOfLocalDay(fromDate) : undefined,
    to: toDate ? endOfLocalDay(toDate) : undefined,
    page,
    limit: PAGE_SIZE,
  };

  const { data: filterOptions } = useQuery({
    queryKey: ['audit-filter-options'],
    queryFn: () => fetchAuditFilterOptionsApi(token),
  });

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['audit-logs', query],
    queryFn: () => fetchAuditLogsApi(query, token),
    enabled: !dateRangeInvalid,
    placeholderData: keepPreviousData,
  });

  // Any filter change starts again from the first page.
  const onFilterChange = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

  const resetFilters = () => {
    setEntityType('');
    setEntityId('');
    setActorId('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-col justify-between gap-4 border-b border-border pb-5 md:flex-row md:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-text">
            <History className="h-5 w-5 text-primary" />
            {t.title}
          </h1>
          <p className="mt-1 text-sm text-text-muted">{t.subtitle}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching || dateRangeInvalid}
          className="gap-1.5"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          {t.refresh}
        </Button>
      </div>

      <Card>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <div className="space-y-1">
            <label htmlFor="audit-entity-type" className="block text-sm font-medium text-text">
              {t.filterEntityType}
            </label>
            <select
              id="audit-entity-type"
              value={entityType}
              onChange={(e) => onFilterChange(setEntityType)(e.target.value)}
              className={selectClassName}
            >
              <option value="">{t.filterAll}</option>
              {filterOptions?.entityTypes.map((type) => (
                <option key={type} value={type}>
                  {entityTypeLabel(type)} ({type})
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <Input
              id="audit-entity-id"
              label={t.filterEntityId}
              placeholder="550e8400-e29b-41d4-a716-446655440000"
              value={entityId}
              onChange={(e) => onFilterChange(setEntityId)(e.target.value)}
              error={entityIdInvalid ? t.filterEntityIdInvalid : undefined}
              className="font-mono"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="audit-actor" className="block text-sm font-medium text-text">
              {t.filterActor}
            </label>
            <select
              id="audit-actor"
              value={actorId}
              onChange={(e) => onFilterChange(setActorId)(e.target.value)}
              className={selectClassName}
            >
              <option value="">{t.filterAll}</option>
              {filterOptions?.actors.map((actor) => (
                <option key={actor.id} value={actor.id}>
                  {actor.fullName} ({actor.email})
                </option>
              ))}
            </select>
          </div>

          <Input
            id="audit-from"
            type="date"
            label={t.filterFrom}
            value={fromDate}
            onChange={(e) => onFilterChange(setFromDate)(e.target.value)}
          />
          <Input
            id="audit-to"
            type="date"
            label={t.filterTo}
            value={toDate}
            onChange={(e) => onFilterChange(setToDate)(e.target.value)}
            error={dateRangeInvalid ? t.filterDateRangeInvalid : undefined}
          />
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="outline" size="sm" onClick={resetFilters}>
            {t.resetFilters}
          </Button>
        </div>
      </Card>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded border border-danger/20 bg-danger-tint p-3 text-sm text-danger-text"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            {t.loadError}: {(error as Error).message}
          </span>
        </div>
      )}

      <Card className="p-0">
        <CardHeader className="border-b border-border px-4 pb-3 pt-4">
          <CardTitle className="text-base font-semibold text-text">
            {t.listTitle} ({numberFormat.format(data?.total ?? 0)})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="sticky top-0 border-b border-border bg-surface text-text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">{t.columnTime}</th>
                  <th className="px-4 py-2.5 font-medium">{t.columnActor}</th>
                  <th className="px-4 py-2.5 font-medium">{t.columnAction}</th>
                  <th className="px-4 py-2.5 font-medium">{t.columnEntity}</th>
                  <th className="px-4 py-2.5 font-medium">{t.columnEntityId}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{t.columnDetail}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                      {t.loading}
                    </td>
                  </tr>
                ) : !data || data.items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                      {t.empty}
                    </td>
                  </tr>
                ) : (
                  data.items.map((log) => (
                    <tr key={log.id} className="hover:bg-primary-tint/40">
                      <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-text-muted">
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td className="px-4 py-2.5">
                        {log.actorName ? (
                          <>
                            <span className="block font-medium text-text">{log.actorName}</span>
                            <span className="block text-xs text-text-muted">{log.actorEmail}</span>
                          </>
                        ) : (
                          <Badge tone="neutral">{t.systemActor}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-text">{log.action}</td>
                      <td className="px-4 py-2.5">
                        <span className="block text-text">{entityTypeLabel(log.entityType)}</span>
                        <span className="block font-mono text-xs text-text-muted">
                          {log.entityType}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-text-muted">
                        {log.entityId}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedLog(log)}
                          className="gap-1"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          {t.viewChanges}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
              <span className="text-text-muted">
                {t.pageInfo} {data.page} / {data.totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  disabled={data.page <= 1 || isFetching}
                >
                  {t.previousPage}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(p + 1, data.totalPages))}
                  disabled={data.page >= data.totalPages || isFetching}
                >
                  {t.nextPage}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedLog && <AuditDetailDialog log={selectedLog} onClose={closeDetail} />}
    </div>
  );
};
