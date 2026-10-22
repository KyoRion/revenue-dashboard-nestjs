'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

type Metric = {
  period: 'CURRENT' | 'PREVIOUS';
  businessDate: string;
  posRevenue: number | string;
  eatclubRevenue: number | string;
  directRevenue: number | string;
  totalRevenue: number | string;
  labourCosts: number | string;
  covers: number;
};

type DashboardEvent = { eventDate: string; label: string; direction: 'POSITIVE' | 'NEGATIVE' };
type DashboardPayload = { weekStart: string; previousWeekStart: string; metrics: Metric[]; events: DashboardEvent[] };

const money = (value: number) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
}).format(value);
const number = (value: number) => new Intl.NumberFormat('en-US').format(value);
const amount = (value: number | string | undefined) => Number(value ?? 0);
const dayKey = (value: string) => new Date(value).toISOString().slice(0, 10);
const weekday = (value: string) => new Date(`${dayKey(value)}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' });
const fullDate = (value: string) => new Date(`${dayKey(value)}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function normalizeDashboard(input: unknown): DashboardPayload | null {
  const raw = Array.isArray(input) ? input[0] : input;
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Partial<DashboardPayload>;
  if (!candidate.weekStart || !Array.isArray(candidate.metrics)) return null;
  return {
    weekStart: candidate.weekStart,
    previousWeekStart: candidate.previousWeekStart ?? '',
    metrics: candidate.metrics,
    events: Array.isArray(candidate.events) ? candidate.events : [],
  };
}

function Icon({ name }: { name: 'chart' | 'download' | 'refresh' | 'up' | 'down' }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const };
  if (name === 'chart') return <svg {...common}><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-5 5"/></svg>;
  if (name === 'download') return <svg {...common}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/></svg>;
  if (name === 'refresh') return <svg {...common}><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.6 9A7 7 0 0 1 18 6l2 2M4 16l2 2a7 7 0 0 0 12.4-3"/></svg>;
  if (name === 'up') return <svg {...common}><path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>;
  return <svg {...common}><path d="m3 7 6 6 4-4 8 8"/><path d="M15 17h6v-6"/></svg>;
}

export default function RevenueDashboard() {
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [compare, setCompare] = useState(false);
  const [visible, setVisible] = useState({ pos: true, eatclub: true, labour: true });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const chartRef = useRef<ChartJS<'bar'> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1').replace(/\/$/, '');
      const response = await fetch(`${baseUrl}/dashboard`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      const result = normalizeDashboard(await response.json());
      if (!result) throw new Error('No dashboard data found. Create a dashboard in the admin API first.');
      setDashboard(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const current = useMemo(() => (dashboard?.metrics ?? []).filter((item) => item.period === 'CURRENT').sort((a, b) => dayKey(a.businessDate).localeCompare(dayKey(b.businessDate))), [dashboard]);
  const previous = useMemo(() => (dashboard?.metrics ?? []).filter((item) => item.period === 'PREVIOUS').sort((a, b) => dayKey(a.businessDate).localeCompare(dayKey(b.businessDate))), [dashboard]);
  const totals = useMemo(() => {
    const revenue = current.reduce((sum, row) => sum + amount(row.totalRevenue), 0);
    const labour = current.reduce((sum, row) => sum + amount(row.labourCosts), 0);
    const covers = current.reduce((sum, row) => sum + row.covers, 0);
    const previousRevenue = previous.reduce((sum, row) => sum + amount(row.totalRevenue), 0);
    const previousCovers = previous.reduce((sum, row) => sum + row.covers, 0);
    return { revenue, labour, covers, previousRevenue, previousCovers, average: current.length ? revenue / current.length : 0 };
  }, [current, previous]);

  const chartData = useMemo<ChartData<'bar'>>(() => {
    const labels = current.map((row) => weekday(row.businessDate));
    const previousByDay = new Map(previous.map((row) => [weekday(row.businessDate), row]));
    const currentRevenueDatasets = [
      { label: compare ? 'POS Revenue (Current)' : 'POS Revenue', data: current.map((row) => amount(row.posRevenue)), backgroundColor: '#282828', stack: 'current-revenue', borderRadius: {
      topLeft: 0,
      topRight: 0,
      bottomLeft: 6,
      bottomRight: 6,
    }, borderSkipped: false, },
      { label: compare ? 'Eatclub Revenue (Current)' : 'Eatclub Revenue', data: current.map((row) => amount(row.eatclubRevenue)), backgroundColor: '#5b5ce2', stack: 'current-revenue', borderRadius: {
      topLeft: 6,
      topRight: 6,
      bottomLeft: 0,
      bottomRight: 0,
    },
    borderSkipped: false, },
    ];
    const datasets = [
      ...(visible.pos ? [currentRevenueDatasets[0]] : []),
      ...(visible.eatclub ? [currentRevenueDatasets[1]] : []),
      ...(visible.labour ? [{ label: compare ? 'Labour Costs (Current)' : 'Labour Costs', data: current.map((row) => amount(row.labourCosts)), backgroundColor: '#f0642b', stack: 'current-labour' }] : []),
      ...(compare ? [
        { label: 'Total Revenue (Previous)', data: labels.map((label) => amount(previousByDay.get(label)?.totalRevenue)), backgroundColor: 'rgba(167, 168, 171, .62)', stack: 'previous-revenue' },
        { label: 'Labour Costs (Previous)', data: labels.map((label) => amount(previousByDay.get(label)?.labourCosts)), backgroundColor: 'rgba(246, 177, 148, .72)', stack: 'previous-labour' },
      ] : []),
    ];
    return { labels, datasets };
  }, [current, previous, compare, visible]);

  const options = useMemo<ChartOptions<'bar'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 250 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: '#202020', padding: 12, titleFont: { size: 12 }, bodyFont: { size: 12 }, callbacks: { label: (context) => ` ${context.dataset.label}: ${money(Number(context.raw ?? 0))}` } },
    },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { color: '#676767', font: { size: 13 } }, stacked: true },
      y: { stacked: true, beginAtZero: true, border: { display: false, dash: [3, 5] }, grid: { color: '#e5e4e2', tickBorderDash: [3, 5] }, ticks: { color: '#696969', maxTicksLimit: 5, callback: (value) => { const n = Number(value); return n === 0 ? '$0' : n >= 1000 ? `$${(n / 1000).toLocaleString('en-US', { maximumFractionDigits: 2 })}k` : `$${n}`; } } },
    },
    datasets: { bar: { borderRadius: 5, borderSkipped: false, categoryPercentage: .76, barPercentage: .82, maxBarThickness: 54 } },
  }), []);

  const exportPng = () => {
    const chart = chartRef.current;
    if (!chart) return;
    const link = document.createElement('a');
    link.download = `revenue-${dashboard ? dayKey(dashboard.weekStart) : 'weekly'}.png`;
    link.href = chart.toBase64Image('image/png', 1);
    link.click();
  };


  return (
    <main className="w-full min-w-0">
      <section className="w-full rounded-2xl border border-stone-200 bg-white p-4 shadow-sm md:p-6" aria-label="Weekly revenue dashboard">
        <header className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0 xl:flex-1">
            <h1 className="m-0 text-xl font-semibold tracking-tight text-stone-900 md:text-2xl">This Week&apos;s Revenue Trend{compare ? ' vs Previous Period' : ''}</h1>
            <p className="mt-1 text-xs text-stone-500">{dashboard ? `${fullDate(dashboard.weekStart)}${dashboard.previousWeekStart ? ` – ${fullDate(new Date(new Date(dashboard.weekStart).getTime() + 6 * 86400000).toISOString())}` : ''}` : 'Weekly performance overview'}</p>
          </div>
          <div className="flex min-w-0 flex-wrap items-center justify-start gap-3 xl:justify-end">
            <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start sm:gap-4" aria-label="Chart metrics">
              <MetricToggle label="POS Revenue" color="dark" checked={visible.pos} onChange={() => setVisible((old) => ({ ...old, pos: !old.pos }))} />
              <MetricToggle label="Eatclub Revenue" color="blue" checked={visible.eatclub} onChange={() => setVisible((old) => ({ ...old, eatclub: !old.eatclub }))} />
              <MetricToggle label="Labour Costs" color="orange" checked={visible.labour} onChange={() => setVisible((old) => ({ ...old, labour: !old.labour }))} />
            </div>
            <button className={`inline-flex h-10 items-center justify-center gap-2 rounded-full border px-3 text-xs font-semibold transition-colors sm:px-4 sm:text-sm ${compare ? 'border-amber-400 bg-amber-300 text-stone-900 hover:bg-amber-400' : 'border-stone-800 bg-stone-800 text-white hover:bg-stone-700'}`} type="button" aria-pressed={compare} onClick={() => setCompare((value) => !value)}>
              <Icon name="chart" /> <span>{compare ? 'Comparing Previous' : 'Compare to Previous'}</span>
            </button>
            <button className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-stone-200 bg-white px-3 text-xs font-semibold text-stone-800 transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:text-sm" type="button" onClick={exportPng} disabled={!current.length}>
              <Icon name="download" /> <span>Export PNG</span>
            </button>
            <button className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-800 transition-colors hover:bg-stone-50 disabled:opacity-50" type="button" onClick={() => void load()} aria-label="Refresh data" title="Refresh data" disabled={loading}>
              <Icon name="refresh" />
            </button>
          </div>
        </header>

        {error ? <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><strong>Could not load dashboard</strong><span className="min-w-0 flex-1">{error}</span><button className="underline" type="button" onClick={() => void load()}>Try again</button></div> : null}
        {loading && !dashboard ? <div className="flex min-h-24 items-center justify-center gap-3 text-sm text-stone-500"><span className="h-5 w-5 animate-spin rounded-full border-2 border-stone-200 border-t-stone-700" /> Loading this week&apos;s dashboard…</div> : null}

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3 md:mt-8 md:gap-5">
          <Kpi title="Total Revenue" value={money(totals.revenue)} comparison={compare ? comparisonText(totals.revenue, totals.previousRevenue, money(totals.previousRevenue)) : undefined} />
          <Kpi title="Average per Day" value={money(totals.average)} comparison={compare && current.length ? comparisonText(totals.average, totals.previousRevenue / Math.max(previous.length, 1), money(totals.previousRevenue / Math.max(previous.length, 1))) : undefined} />
          <Kpi title="Total Covers" value={number(totals.covers)} comparison={compare ? comparisonText(totals.covers, totals.previousCovers, number(totals.previousCovers)) : undefined} />
        </div>

        <div className="relative mt-5 h-[clamp(250px,36vh,360px)] min-h-[250px] md:mt-6 md:h-[clamp(280px,36vh,360px)] md:min-h-[280px]">
          {current.length ? <Bar ref={chartRef} data={chartData} options={options} /> : !loading && !error ? <div className="absolute inset-0 grid place-items-center text-sm text-stone-500">No metrics are available for this week yet.</div> : null}
          {dashboard?.events.map((event) => {
            const index = current.findIndex((row) => dayKey(row.businessDate) === dayKey(event.eventDate));
            if (index < 0) return null;
            return <span key={`${event.eventDate}-${event.label}`} className={`pointer-events-auto absolute z-10 grid h-9 w-9 -translate-x-1/2 place-items-center rounded-full ${event.direction === 'POSITIVE' ? 'border-2 border-green-200 bg-green-50 text-green-600' : 'border-2 border-red-200 bg-red-50 text-red-600'}`} style={{ left: `${11 + (index / Math.max(current.length - 1, 1)) * 78}%`, top: event.direction === 'POSITIVE' ? '4%' : '15%' }} title={`${event.label} · ${weekday(event.eventDate)}`}><Icon name={event.direction === 'POSITIVE' ? 'up' : 'down'} /></span>;
          })}
        </div>

        <footer className="pt-4">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            {visible.pos ? <LegendItem color="dark" label={compare ? 'POS Revenue (Current)' : 'POS Revenue'} /> : null}
            {visible.eatclub ? <LegendItem color="blue" label={compare ? 'Eatclub Revenue (Current)' : 'Eatclub Revenue'} /> : null}
            {visible.labour ? <LegendItem color="orange" label={compare ? 'Labour Costs (Current)' : 'Labour Costs'} /> : null}
            {compare ? <><LegendItem color="muted" label="Total Revenue (Previous)" /><LegendItem color="peach" label="Labour Costs (Previous)" /></> : null}
            {dashboard?.events.some((event) => event.direction === 'POSITIVE') ? <LegendItem color="green" label="Positive Event Impact" icon="up" /> : null}
            {dashboard?.events.some((event) => event.direction === 'NEGATIVE') ? <LegendItem color="red" label="Negative Event Impact" icon="down" /> : null}
          </div>
          {dashboard?.events.length ? <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-stone-500">{dashboard.events.map((event) => <span key={`${event.eventDate}-${event.label}`}>{weekday(event.eventDate)} · {event.label}</span>)}</div> : null}
        </footer>
      </section>
    </main>
  );
}

function comparisonText(value: number, previous: number, previousLabel: string) {
  const change = previous ? ((value - previous) / previous) * 100 : 0;
  const sign = change > 0 ? '+' : '';
  return <>vs {previousLabel} <strong className={change >= 0 ? 'text-green-600' : 'text-red-600'}>({sign}{change.toFixed(1)}%)</strong></>;
}

function Kpi({ title, value, comparison }: { title: string; value: string; comparison?: React.ReactNode }) {
  return <article className="flex min-h-[78px] min-w-0 flex-col justify-center gap-1 rounded-2xl bg-stone-50 px-4 py-3 md:min-h-[90px] md:px-5"><span className="text-sm text-stone-600">{title}</span><div className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><strong className="text-2xl font-semibold tracking-tight text-stone-900 md:text-[28px]">{value}</strong>{comparison ? <span className="text-xs text-stone-600 md:text-sm">{comparison}</span> : null}</div></article>;
}

function MetricToggle({ label, color, checked, onChange }: { label: string; color: string; checked: boolean; onChange: () => void }) {
  const swatch: Record<string, string> = { dark: 'bg-stone-800', blue: 'bg-indigo-500', orange: 'bg-orange-500' };
  return <label className="inline-flex cursor-pointer select-none items-center gap-1.5 whitespace-nowrap text-[11px] text-stone-600 sm:gap-2 sm:text-sm"><input className="peer sr-only" type="checkbox" checked={checked} onChange={onChange} /><span className="grid h-[18px] w-[18px] place-items-center rounded border border-stone-400 bg-white text-xs font-bold text-white peer-checked:border-stone-800 peer-checked:bg-stone-800">{checked ? '✓' : ''}</span><span className={`h-[3px] w-3 rounded-full sm:w-4 ${swatch[color] ?? 'bg-stone-500'}`} /><span>{label}</span></label>;
}

function LegendItem({ color, label, icon }: { color: string; label: string; icon?: 'up' | 'down' }) {
  const dot: Record<string, string> = { dark: 'bg-stone-800', blue: 'bg-indigo-500', orange: 'bg-orange-500', muted: 'bg-neutral-400', peach: 'bg-orange-200', green: 'text-green-600', red: 'text-red-600' };
  return <span className="inline-flex items-center gap-2 whitespace-nowrap text-xs text-stone-600 sm:text-sm"><span className={`grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full ${dot[color] ?? 'bg-stone-400'} ${icon ? 'bg-transparent' : ''}`}>{icon ? <Icon name={icon} /> : null}</span>{label}</span>;
}
