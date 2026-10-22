export type Period = 'CURRENT' | 'PREVIOUS';
export type Direction = 'POSITIVE' | 'NEGATIVE';
export type Metric = {
  period: Period;
  businessDate: string;
  posRevenue: number | string;
  eatclubRevenue: number | string;
  directRevenue: number | string;
  totalRevenue: number | string;
  labourCosts: number | string;
  covers: number;
};
export type DashboardEvent = { eventDate: string; label: string; direction: Direction };
export type Dashboard = {
  id?: string;
  weekStart: string;
  previousWeekStart: string;
  metrics: Metric[];
  events: DashboardEvent[];
};
export type Admin = { email?: string; role?: string };
export const TOKEN_KEY = 'revenue-dashboard-admin-token';

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function api<T>(path: string, token?: string, init: RequestInit = {}): Promise<T> {
  const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1').replace(/\/$/, '');
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${base}${path}`, { ...init, headers, cache: 'no-store' });
  const text = await response.text();
  let data: unknown;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!response.ok) {
    const message = (data as { message?: string | string[] } | null)?.message;
    throw new ApiError(Array.isArray(message) ? message.join('. ') : message || `Request failed (${response.status})`, response.status);
  }
  return data as T;
}
