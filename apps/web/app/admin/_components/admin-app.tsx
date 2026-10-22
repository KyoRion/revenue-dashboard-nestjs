'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { api, ApiError, TOKEN_KEY, type Admin, type Dashboard, type DashboardEvent, type Metric, type Period } from '../_lib/api';

const field = 'w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-stone-100';
const primary = 'inline-flex items-center justify-center rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-50';
const secondary = 'inline-flex items-center justify-center rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50';
const dateOnly = (value: string) => value.slice(0, 10);
const addDays = (value: string, days: number) => {
  const date = new Date(`${dateOnly(value)}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
const dollars = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
const totalRevenue = (metric: Metric) => Number(metric.posRevenue) + Number(metric.eatclubRevenue) + Number(metric.directRevenue);
const weekday = (value: string) => new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));

function blankRows(period: Period, start: string): Metric[] {
  return Array.from({ length: 7 }, (_, i) => ({ period, businessDate: addDays(start, i), posRevenue: 0, eatclubRevenue: 0, directRevenue: 0, totalRevenue: 0, labourCosts: 0, covers: 0 }));
}
function blankDashboard(): Dashboard {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const monday = addDays(today, -((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7));
  const previous = addDays(monday, -7);
  return { weekStart: monday, previousWeekStart: previous, metrics: [...blankRows('CURRENT', monday), ...blankRows('PREVIOUS', previous)], events: [] };
}
function editableDashboard(data: Dashboard): Dashboard {
  const start = dateOnly(data.weekStart);
  const previous = dateOnly(data.previousWeekStart);
  return {
    weekStart: start,
    previousWeekStart: previous,
    metrics: [...blankRows('CURRENT', start), ...blankRows('PREVIOUS', previous)].map((blank) => {
      const row = data.metrics.find((item) => item.period === blank.period && dateOnly(item.businessDate) === blank.businessDate);
      return row ? { ...blank, posRevenue: Number(row.posRevenue), eatclubRevenue: Number(row.eatclubRevenue), directRevenue: Number(row.directRevenue), totalRevenue: Number(row.totalRevenue), labourCosts: Number(row.labourCosts), covers: Number(row.covers) } : blank;
    }),
    events: (data.events || []).map((event) => ({ eventDate: dateOnly(event.eventDate), label: event.label, direction: event.direction })),
  };
}
function errorText(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong. Please try again.'; }

export default function AdminApp() {
  const [token, setToken] = useState('');
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [checking, setChecking] = useState(true);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [editor, setEditor] = useState<Dashboard | null>(null);
  const [originalWeek, setOriginalWeek] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Dashboard | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(''); setAdmin(null); setDashboards([]); setEditor(null); setDeleting(null); setNotice('');
  }
  function handleError(cause: unknown) {
    if (cause instanceof ApiError && cause.status === 401) {
      logout();
      setError('Your session has expired. Please sign in again.');
    } else setError(errorText(cause));
  }
  async function loadDashboards(accessToken: string) {
    setLoading(true);
    try {
      const data = await api<Dashboard[]>('/admin/dashboards', accessToken);
      if (!Array.isArray(data)) throw new Error('The dashboard API must return an array.');
      setDashboards([...data].sort((a, b) => b.weekStart.localeCompare(a.weekStart)));
    } finally { setLoading(false); }
  }
  useEffect(() => {
    let active = true;
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) { setChecking(false); return; }
    void (async () => {
      try {
        const user = await api<Admin>('/auth/me', stored);
        if (!active) return;
        setToken(stored); setAdmin(user);
        await loadDashboards(stored);
      } catch (cause) {
        if (active) {
          if (cause instanceof ApiError && cause.status === 401) localStorage.removeItem(TOKEN_KEY);
          setError(errorText(cause));
        }
      } finally { if (active) setChecking(false); }
    })();
    return () => { active = false; };
  }, []);

  async function onLogin(accessToken: string, user: Admin) {
    localStorage.setItem(TOKEN_KEY, accessToken);
    setToken(accessToken); setAdmin(user); setError('');
    try { await loadDashboards(accessToken); } catch (cause) { handleError(cause); }
  }
  async function saveDashboard(payload: Dashboard) {
    setError(''); setNotice('');
    const updating = originalWeek !== null;
    try {
      await api(updating ? `/admin/dashboards/${encodeURIComponent(originalWeek)}` : '/admin/dashboards', token, {
        method: updating ? 'PUT' : 'POST', body: JSON.stringify(payload),
      });
    } catch (cause) {
      handleError(cause);
      throw cause;
    }
    setEditor(null); setOriginalWeek(null);
    setNotice(updating ? 'Dashboard updated successfully.' : 'Dashboard created successfully.');
    try { await loadDashboards(token); } catch (cause) { handleError(cause); }
  }
  async function deleteDashboard() {
    if (!deleting) return;
    setDeletingBusy(true); setError(''); setNotice('');
    try {
      await api(`/admin/dashboards/${encodeURIComponent(dateOnly(deleting.weekStart))}`, token, { method: 'DELETE' });
      setDeleting(null); setNotice('Dashboard deleted successfully.');
      await loadDashboards(token);
    } catch (cause) { handleError(cause); }
    finally { setDeletingBusy(false); }
  }

  if (checking) return <div className="grid min-h-[50vh] place-items-center text-sm text-stone-500">Checking your session…</div>;
  if (!token || !admin) return <LoginForm onLogin={onLogin} externalError={error} />;

  return (
    <main className="min-h-screen bg-stone-50 p-4 text-stone-900 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Revenue dashboard</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Admin workspace</h1><p className="mt-1 text-sm text-stone-500">Manage weekly metrics and event impacts.</p></div>
          <div className="flex flex-wrap items-center gap-3"><span className="text-sm text-stone-500">{admin.email || 'Administrator'}</span><a href="/" className={secondary}>View dashboard ↗</a><button type="button" className={secondary} onClick={logout}>Sign out</button></div>
        </header>
        {error ? <Message kind="error">{error}</Message> : null}
        {notice ? <Message kind="success">{notice}</Message> : null}
        {editor ? <DashboardEditor initial={editor} updating={originalWeek !== null} onSave={saveDashboard} onCancel={() => { setEditor(null); setError(''); }} /> : (
          <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-100 p-5">
              <div><h2 className="font-semibold">Weekly dashboards</h2><p className="mt-1 text-sm text-stone-500">{dashboards.length} dashboard{dashboards.length !== 1 ? 's' : ''}</p></div>
              <div className="flex gap-2"><button type="button" className={secondary} disabled={loading} onClick={() => { setError(''); void loadDashboards(token).catch(handleError); }}>{loading ? 'Refreshing…' : 'Refresh'}</button><button type="button" className={primary} onClick={() => { setOriginalWeek(null); setEditor(blankDashboard()); setError(''); setNotice(''); }}>+ Create dashboard</button></div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500"><tr>{['Week', 'Previous period', 'Revenue', 'Covers', 'Events', 'Actions'].map((title) => <th key={title} className="px-5 py-3 font-medium">{title}</th>)}</tr></thead>
                <tbody className="divide-y divide-stone-100">
                  {dashboards.map((dashboard) => {
                    const rows = dashboard.metrics.filter((row) => row.period === 'CURRENT');
                    return <tr key={dashboard.id || dashboard.weekStart} className="hover:bg-stone-50/70"><td className="px-5 py-4 font-medium">{dateOnly(dashboard.weekStart)}<span className="mt-1 block text-xs font-normal text-stone-500">to {addDays(dashboard.weekStart, 6)}</span></td><td className="px-5 py-4 text-stone-500">{dateOnly(dashboard.previousWeekStart)}</td><td className="px-5 py-4 font-medium">{dollars(rows.reduce((sum, row) => sum + Number(row.totalRevenue), 0))}</td><td className="px-5 py-4">{rows.reduce((sum, row) => sum + Number(row.covers), 0)}</td><td className="px-5 py-4">{dashboard.events?.length || 0}</td><td className="px-5 py-4"><div className="flex gap-4"><button type="button" className="font-medium text-indigo-600 hover:underline" onClick={() => { setEditor(editableDashboard(dashboard)); setOriginalWeek(dateOnly(dashboard.weekStart)); setError(''); setNotice(''); }}>Edit</button><button type="button" className="font-medium text-red-600 hover:underline" onClick={() => setDeleting(dashboard)}>Delete</button></div></td></tr>;
                  })}
                  {!dashboards.length ? <tr><td colSpan={6} className="px-5 py-14 text-center text-stone-500">{loading ? 'Loading dashboards…' : 'No dashboards yet. Create your first week to get started.'}</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
      {deleting ? <div className="fixed inset-0 z-50 grid place-items-center bg-stone-950/40 p-4"><section role="dialog" aria-modal="true" aria-labelledby="delete-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"><h2 id="delete-title" className="text-lg font-semibold">Delete this dashboard?</h2><p className="mt-2 text-sm leading-6 text-stone-600">The week starting {dateOnly(deleting.weekStart)}, all daily metrics, and its events will be deleted.</p><div className="mt-6 flex justify-end gap-3"><button type="button" className={secondary} disabled={deletingBusy} onClick={() => setDeleting(null)}>Cancel</button><button type="button" className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50" disabled={deletingBusy} onClick={() => void deleteDashboard()}>{deletingBusy ? 'Deleting…' : 'Delete dashboard'}</button></div></section></div> : null}
    </main>
  );
}

function LoginForm({ onLogin, externalError }: { onLogin: (token: string, admin: Admin) => Promise<void>; externalError: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = await api<{ accessToken?: string; access_token?: string }>('/auth/login', undefined, { method: 'POST', body: JSON.stringify({ email: email.trim(), password }) });
      const accessToken = result.accessToken || result.access_token;
      if (!accessToken) throw new Error('The login API did not return an access token.');
      const user = await api<Admin>('/auth/me', accessToken);
      await onLogin(accessToken, user);
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  }
  return <main className="grid min-h-screen place-items-center bg-stone-50 p-5 text-stone-900"><section className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-7 shadow-sm"><p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Revenue dashboard</p><h1 className="mt-3 text-2xl font-semibold">Admin sign in</h1><p className="mt-2 text-sm text-stone-500">Use your administrator account to manage dashboard data.</p>{error || externalError ? <div className="mt-5"><Message kind="error">{error || externalError}</Message></div> : null}<form onSubmit={submit} className="mt-6 space-y-5"><label className="block text-sm font-medium">Email<input required type="email" autoComplete="username" className={`${field} mt-2`} value={email} onChange={(event) => setEmail(event.target.value)} /></label><label className="block text-sm font-medium">Password<input required type="password" autoComplete="current-password" className={`${field} mt-2`} value={password} onChange={(event) => setPassword(event.target.value)} /></label><button disabled={busy} type="submit" className={`${primary} w-full`}>{busy ? 'Signing in…' : 'Sign in'}</button></form><a className="mt-5 block text-center text-sm text-stone-500 hover:text-stone-900" href="/">← Back to dashboard</a></section></main>;
}

type NumericKey = 'posRevenue' | 'eatclubRevenue' | 'directRevenue' | 'labourCosts' | 'covers';
const columns: { key: NumericKey; label: string }[] = [{ key: 'posRevenue', label: 'POS revenue' }, { key: 'eatclubRevenue', label: 'Eatclub revenue' }, { key: 'directRevenue', label: 'Direct revenue' }, { key: 'labourCosts', label: 'Labour costs' }, { key: 'covers', label: 'Covers' }];

function DashboardEditor({ initial, updating, onSave, onCancel }: { initial: Dashboard; updating: boolean; onSave: (payload: Dashboard) => Promise<void>; onCancel: () => void }) {
  const [form, setForm] = useState(initial);
  const [period, setPeriod] = useState<Period>('CURRENT');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const rows = form.metrics.filter((row) => row.period === period);
  function changeStart(key: 'weekStart' | 'previousWeekStart', value: string) {
    if (!value) return;
    const target: Period = key === 'weekStart' ? 'CURRENT' : 'PREVIOUS';
    let index = 0;
    setForm((old) => ({ ...old, [key]: value, metrics: old.metrics.map((row) => row.period === target ? { ...row, businessDate: addDays(value, index++) } : row) }));
  }
  function changeMetric(date: string, key: NumericKey, value: string) {
    setForm((old) => ({ ...old, metrics: old.metrics.map((row) => row.period === period && row.businessDate === date ? { ...row, [key]: value } : row) }));
  }
  function changeEvent(index: number, patch: Partial<DashboardEvent>) {
    setForm((old) => ({ ...old, events: old.events.map((event, i) => i === index ? { ...event, ...patch } : event) }));
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    const metrics = form.metrics.map((row) => ({ period: row.period, businessDate: row.businessDate, posRevenue: Number(row.posRevenue), eatclubRevenue: Number(row.eatclubRevenue), directRevenue: Number(row.directRevenue), labourCosts: Number(row.labourCosts), covers: Number(row.covers), totalRevenue: totalRevenue(row) }));
    if (metrics.some((row) => columns.some(({ key }) => !Number.isFinite(row[key]) || row[key] < 0) || !Number.isInteger(row.covers))) { setError('Enter non-negative amounts and whole numbers for covers.'); return; }
    if (form.previousWeekStart >= form.weekStart) { setError('The previous period must start before the current period.'); return; }
    if (form.events.some((item) => !item.label.trim() || item.eventDate < form.weekStart || item.eventDate > addDays(form.weekStart, 6))) { setError('Every event needs a label and a date within the current week.'); return; }
    setBusy(true);
    try { await onSave({ weekStart: form.weekStart, previousWeekStart: form.previousWeekStart, metrics, events: form.events.map((item) => ({ ...item, label: item.label.trim() })) }); }
    catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="space-y-5">
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">{updating ? 'Edit dashboard' : 'Create dashboard'}</h2><p className="mt-1 text-sm text-stone-500">Enter seven days for each period. Revenue totals are calculated automatically.</p></div><button type="button" className={secondary} onClick={onCancel} disabled={busy}>Back to list</button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Current week starts<input className={`${field} mt-2`} required type="date" value={form.weekStart} disabled={updating || busy} onChange={(event) => changeStart('weekStart', event.target.value)} /></label><label className="text-sm font-medium">Previous period starts<input className={`${field} mt-2`} required type="date" value={form.previousWeekStart} disabled={busy} onChange={(event) => changeStart('previousWeekStart', event.target.value)} /></label></div></section>
    <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 p-5"><h3 className="font-semibold">Daily metrics</h3><div className="flex gap-1 rounded-lg bg-stone-100 p-1">{(['CURRENT', 'PREVIOUS'] as Period[]).map((value) => <button key={value} type="button" aria-pressed={period === value} onClick={() => setPeriod(value)} className={`rounded-md px-3 py-1.5 text-sm font-medium ${period === value ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>{value === 'CURRENT' ? 'Current week' : 'Previous period'}</button>)}</div></div><div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-sm"><thead className="bg-stone-50 text-xs text-stone-500"><tr><th className="px-4 py-3 font-medium">Date</th>{columns.map((column) => <th key={column.key} className="px-3 py-3 font-medium">{column.label}</th>)}<th className="px-4 py-3 font-medium">Total revenue</th></tr></thead><tbody className="divide-y divide-stone-100">{rows.map((row) => <tr key={`${row.period}-${row.businessDate}`}><td className="whitespace-nowrap px-4 py-3"><span className="font-medium">{weekday(row.businessDate)}</span><span className="mt-1 block text-xs text-stone-500">{row.businessDate}</span></td>{columns.map((column) => <td key={column.key} className="px-3 py-3"><input aria-label={`${row.businessDate} ${column.label}`} className={`${field} min-w-24 text-right`} type="number" min="0" step={column.key === 'covers' ? '1' : '0.01'} required value={row[column.key]} disabled={busy} onChange={(event) => changeMetric(row.businessDate, column.key, event.target.value)} /></td>)}<td className="whitespace-nowrap px-4 py-3 text-right font-medium">{dollars(totalRevenue(row))}</td></tr>)}</tbody><tfoot className="border-t border-stone-200 bg-stone-50"><tr><td className="px-4 py-3 font-semibold">Total</td>{columns.map(({ key }) => <td key={key} className="px-3 py-3 text-right font-medium">{key === 'covers' ? rows.reduce((sum, row) => sum + Number(row[key]), 0) : dollars(rows.reduce((sum, row) => sum + Number(row[key]), 0))}</td>)}<td className="px-4 py-3 text-right font-semibold">{dollars(rows.reduce((sum, row) => sum + totalRevenue(row), 0))}</td></tr></tfoot></table></div></section>
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold">Event impacts</h3><p className="mt-1 text-sm text-stone-500">Add events that affect this week.</p></div><button type="button" disabled={busy} className={secondary} onClick={() => setForm((old) => ({ ...old, events: [...old.events, { eventDate: old.weekStart, label: '', direction: 'POSITIVE' }] }))}>+ Add event</button></div><div className="mt-5 space-y-3">{form.events.length ? form.events.map((event, index) => <div key={index} className="grid items-end gap-3 rounded-xl bg-stone-50 p-3 md:grid-cols-[180px_1fr_160px_auto]"><label className="text-xs font-medium text-stone-600">Date<input className={`${field} mt-1`} required type="date" value={event.eventDate} min={form.weekStart} max={addDays(form.weekStart, 6)} disabled={busy} onChange={(e) => changeEvent(index, { eventDate: e.target.value })} /></label><label className="text-xs font-medium text-stone-600">Label<input className={`${field} mt-1`} required maxLength={200} placeholder="e.g. Local festival" value={event.label} disabled={busy} onChange={(e) => changeEvent(index, { label: e.target.value })} /></label><label className="text-xs font-medium text-stone-600">Impact<select className={`${field} mt-1`} value={event.direction} disabled={busy} onChange={(e) => changeEvent(index, { direction: e.target.value as DashboardEvent['direction'] })}><option value="POSITIVE">Positive</option><option value="NEGATIVE">Negative</option></select></label><button type="button" disabled={busy} className="rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50" onClick={() => setForm((old) => ({ ...old, events: old.events.filter((_, i) => i !== index) }))}>Remove</button></div>) : <p className="rounded-xl border border-dashed border-stone-200 p-5 text-center text-sm text-stone-500">No events added. This section is optional.</p>}</div></section>
    {error ? <Message kind="error">{error}</Message> : null}
    <div className="flex justify-end gap-3"><button type="button" className={secondary} disabled={busy} onClick={onCancel}>Cancel</button><button type="submit" className={primary} disabled={busy}>{busy ? 'Saving…' : updating ? 'Save changes' : 'Create dashboard'}</button></div>
  </form>;
}

function Message({ kind, children }: { kind: 'error' | 'success'; children: ReactNode }) {
  return <div role={kind === 'error' ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm ${kind === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-green-200 bg-green-50 text-green-800'}`}>{children}</div>;
}
