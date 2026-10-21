import {
  type DashboardStepRowDto,
  type DashboardWipSummaryDto,
  OrderStatus,
  type StationType,
  type StepStatus,
} from '@denimflow/shared';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import React from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge, type BadgeProps } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { fetchDashboardWipApi } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { i18n } from '../../lib/i18n/dictionary';

const t = i18n.dashboard;

// Design tokens (docs/design/DESIGN.md); Recharts needs raw colors, not Tailwind classes.
const COLOR = {
  primary: '#2F5D8A',
  primaryTint: '#E8EFF6',
  border: '#E2E5EA',
  textMuted: '#5B6672',
  text: '#1F2933',
};
const BAR_ROW_HEIGHT = 36;
const AXIS_BAND = 32;

type Tone = NonNullable<BadgeProps['tone']>;

// Badge tones from DESIGN.md "Status badges".
const ORDER_TONE: Record<OrderStatus, Tone> = {
  DRAFT: 'neutral',
  CONFIRMED: 'info',
  IN_PRODUCTION: 'primary',
  ON_HOLD: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
};
const STEP_TONE: Partial<Record<StepStatus, Tone>> = {
  READY: 'info',
  IN_PROGRESS: 'primary',
  WAITING_QC: 'warning',
  REWORK: 'warning',
};

const formatNumber = (value: number) => value.toLocaleString('vi-VN');
const stationLabel = (stationType: StationType | null) =>
  stationType ? i18n.stationType[stationType] : t.noStation;

export const WipDashboardPage: React.FC = () => {
  const { token } = useAuth();
  const { data, error, isLoading, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['dashboard', 'wip'],
    queryFn: () => fetchDashboardWipApi(token),
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-text-muted">
        <RefreshCw className="h-4 w-4 animate-spin text-primary" />
        {t.loading}
      </div>
    );
  }

  if (!data) {
    return (
      <Card className="mx-auto max-w-lg border-danger/30 text-center">
        <AlertTriangle className="mx-auto h-6 w-6 text-danger" />
        <p className="mt-2 text-sm font-semibold text-danger-text">{t.loadError}</p>
        <p className="mt-1 text-xs text-text-muted">{(error as Error | null)?.message}</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
          {i18n.common.retry}
        </Button>
      </Card>
    );
  }

  return (
    // Keep the previous numbers on screen while refetching, slightly dimmed (no layout jump).
    <div
      className={`mx-auto max-w-[1280px] space-y-6 transition-opacity ${isFetching ? 'opacity-70' : ''}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text">{t.title}</h1>
          <p className="text-sm text-text-muted">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted tabular-nums">
            {t.updatedAt} {new Date(dataUpdatedAt).toLocaleTimeString('vi-VN')}
          </span>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            {isFetching ? t.refreshing : t.refresh}
          </Button>
        </div>
      </div>

      {/* A failed refetch keeps the last numbers; say so, or they read as current. */}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded border border-warning/50 bg-warning-tint px-3 py-2 text-sm text-warning-text"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{t.staleWarning}</span>
          <span className="text-xs text-text-muted">{(error as Error).message}</span>
        </div>
      )}

      <KpiRow data={data} />

      <div className="grid gap-6 lg:grid-cols-3">
        <WipChart steps={data.steps.filter((step) => step.openOrderCount > 0)} />
        <OrdersByStatus data={data} />
      </div>

      <StepTable steps={data.steps} />
      <WaitingQcTable items={data.waitingQc} />
    </div>
  );
};

const KpiTile: React.FC<{ label: string; value: string; hint: string; accent?: boolean }> = ({
  label,
  value,
  hint,
  accent,
}) => (
  <Card className={accent ? 'border-warning/50' : undefined}>
    <p className="text-xs font-medium text-text-muted">{label}</p>
    <p className="mt-1 text-2xl font-semibold text-text tabular-nums">{value}</p>
    <p className="mt-1 text-xs text-text-muted tabular-nums">{hint}</p>
  </Card>
);

const KpiRow: React.FC<{ data: DashboardWipSummaryDto }> = ({ data: { totals } }) => (
  <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
    <KpiTile
      label={t.kpiOrders}
      value={formatNumber(totals.totalOrders)}
      hint={t.kpiOrdersHint(totals.activeOrders, totals.completedOrders)}
    />
    <KpiTile
      label={t.kpiWip}
      value={formatNumber(totals.wipBundleCount)}
      hint={t.kpiWipHint(formatNumber(totals.wipQty))}
    />
    <KpiTile
      label={t.kpiDefect}
      value={formatNumber(totals.totalQtyDefect)}
      hint={t.kpiDefectHint(totals.totalReworkCount)}
    />
    <KpiTile
      label={t.kpiWaitingQc}
      value={formatNumber(totals.waitingQcOrderCount)}
      hint={t.kpiWaitingQcHint}
      accent={totals.waitingQcOrderCount > 0}
    />
  </div>
);

// Only the two Recharts tooltip props we read; the row is the bar's data item.
const WipTooltip: React.FC<{
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown }>;
}> = ({ active, payload }) => {
  const row = payload?.[0]?.payload as DashboardStepRowDto | undefined;
  if (!active || !row) {
    return null;
  }
  return (
    <div className="rounded border border-border bg-surface px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-text">{row.stepName}</p>
      <p className="font-mono text-[11px] text-text-muted">{row.stepCode}</p>
      <dl className="mt-1 grid grid-cols-[auto_auto] gap-x-3 tabular-nums text-text">
        <dt className="text-text-muted">{t.tooltipPieces}</dt>
        <dd className="text-right">{formatNumber(row.wipQty)}</dd>
        <dt className="text-text-muted">{t.tooltipBundles}</dt>
        <dd className="text-right">{formatNumber(row.wipBundleCount)}</dd>
        <dt className="text-text-muted">{t.tooltipOrders}</dt>
        <dd className="text-right">{formatNumber(row.openOrderCount)}</dd>
      </dl>
    </div>
  );
};

// One series (pieces at each open step), so one color and no legend; the table below is the
// accessible twin of this chart.
const WipChart: React.FC<{ steps: DashboardStepRowDto[] }> = ({ steps }) => (
  <Card className="lg:col-span-2">
    <CardHeader>
      <CardTitle>{t.wipChartTitle}</CardTitle>
      <CardDescription className="text-xs">{t.wipChartDescription}</CardDescription>
    </CardHeader>
    <CardContent className="p-0">
      {steps.length === 0 ? (
        <p className="py-12 text-center text-sm text-text-muted">{t.wipChartEmpty}</p>
      ) : (
        <div style={{ height: steps.length * BAR_ROW_HEIGHT + AXIS_BAND }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={steps}
              layout="vertical"
              margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
            >
              <CartesianGrid horizontal={false} stroke={COLOR.border} />
              <XAxis
                type="number"
                allowDecimals={false}
                tick={{ fontSize: 12, fill: COLOR.textMuted }}
                tickLine={false}
                axisLine={{ stroke: COLOR.border }}
              />
              <YAxis
                type="category"
                dataKey="stepCode"
                width={150}
                tick={{ fontSize: 12, fill: COLOR.text, fontFamily: 'ui-monospace, monospace' }}
                tickLine={false}
                axisLine={{ stroke: COLOR.border }}
              />
              <Tooltip
                content={({ active, payload }) => <WipTooltip active={active} payload={payload} />}
                cursor={{ fill: COLOR.primaryTint }}
              />
              <Bar dataKey="wipQty" fill={COLOR.primary} barSize={16} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </CardContent>
  </Card>
);

const OrdersByStatus: React.FC<{ data: DashboardWipSummaryDto }> = ({ data }) => {
  const max = Math.max(...Object.values(data.ordersByStatus), 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.ordersTitle}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {data.totals.totalOrders === 0 ? (
          <p className="py-12 text-center text-sm text-text-muted">{t.ordersEmpty}</p>
        ) : (
          <ul className="space-y-3">
            {Object.values(OrderStatus).map((status) => {
              const count = data.ordersByStatus[status] ?? 0;
              return (
                <li key={status} className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-3">
                  <Badge tone={ORDER_TONE[status]} className="justify-self-start">
                    {i18n.orderStatus[status]}
                  </Badge>
                  <div className="h-2 rounded-full bg-neutral-tint" aria-hidden="true">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: max > 0 ? `${(count / max) * 100}%` : 0 }}
                    />
                  </div>
                  <span className="text-right text-sm tabular-nums text-text">
                    {formatNumber(count)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

const Th: React.FC<{ children: React.ReactNode; numeric?: boolean }> = ({ children, numeric }) => (
  <th className={`px-4 py-2.5 font-medium ${numeric ? 'text-right' : ''}`}>{children}</th>
);

const NumberCell: React.FC<{ value: number | null }> = ({ value }) => (
  <td className="px-4 py-2.5 text-right tabular-nums text-text">
    {value === null ? '—' : formatNumber(value)}
  </td>
);

const StepTable: React.FC<{ steps: DashboardStepRowDto[] }> = ({ steps }) => (
  <Card className="p-0">
    <CardHeader className="p-4">
      <CardTitle>{t.stepsTitle}</CardTitle>
      <CardDescription className="text-xs">{t.stepsDescription}</CardDescription>
    </CardHeader>
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[13px]">
        <thead className="border-y border-border text-text-muted">
          <tr>
            <Th>{t.colStep}</Th>
            <Th>{t.colStation}</Th>
            <Th numeric>{t.colOpenOrders}</Th>
            <Th numeric>{t.colWipBundles}</Th>
            <Th numeric>{t.colWipQty}</Th>
            <Th numeric>{t.colQtyIn}</Th>
            <Th numeric>{t.colQtyGood}</Th>
            <Th numeric>{t.colQtyDefect}</Th>
            <Th numeric>{t.colRework}</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {steps.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-4 py-8 text-center text-text-muted">
                {t.stepsEmpty}
              </td>
            </tr>
          ) : (
            steps.map((step) => (
              <tr key={step.stepCode} className="hover:bg-primary-tint/40">
                <td className="px-4 py-2.5">
                  <span className="block text-text">{step.stepName}</span>
                  <span className="block font-mono text-[11px] text-text-muted">
                    {step.stepCode}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-text-muted">{stationLabel(step.stationType)}</td>
                <NumberCell value={step.openOrderCount} />
                <NumberCell value={step.wipBundleCount} />
                <NumberCell value={step.wipQty} />
                {/* Planner and QC steps do not record quantities (FR-13). */}
                <NumberCell value={step.tracksQuantities ? step.qtyIn : null} />
                <NumberCell value={step.tracksQuantities ? step.qtyGood : null} />
                <NumberCell value={step.tracksQuantities ? step.qtyDefect : null} />
                <NumberCell value={step.reworkCount} />
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </Card>
);

const WaitingQcTable: React.FC<{ items: DashboardWipSummaryDto['waitingQc'] }> = ({ items }) => (
  <Card className="p-0">
    <CardHeader className="p-4">
      <CardTitle>{t.waitingQcTitle}</CardTitle>
      <CardDescription className="text-xs">{t.waitingQcDescription}</CardDescription>
    </CardHeader>
    {items.length === 0 ? (
      <p className="px-4 pb-6 text-sm text-text-muted">{t.waitingQcEmpty}</p>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead className="border-y border-border text-text-muted">
            <tr>
              <Th>{t.colOrder}</Th>
              <Th>{t.colStyle}</Th>
              <Th>{t.colStep}</Th>
              <Th>{t.colStation}</Th>
              <Th>{t.colStatus}</Th>
              <Th>{t.colStartedAt}</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((item) => (
              <tr key={item.stepInstanceId} className="hover:bg-primary-tint/40">
                <td className="px-4 py-2.5 font-mono text-text">{item.orderNumber}</td>
                <td className="px-4 py-2.5 font-mono text-text-muted">{item.styleCode}</td>
                <td className="px-4 py-2.5">
                  <span className="block text-text">{item.stepName}</span>
                  <span className="block font-mono text-[11px] text-text-muted">
                    {item.stepCode}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-text-muted">{stationLabel(item.stationType)}</td>
                <td className="px-4 py-2.5">
                  <Badge tone={STEP_TONE[item.status] ?? 'neutral'}>
                    {i18n.stepStatus[item.status]}
                  </Badge>
                </td>
                <td className="px-4 py-2.5 tabular-nums text-text-muted">
                  {item.startedAt ? new Date(item.startedAt).toLocaleString('vi-VN') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </Card>
);
