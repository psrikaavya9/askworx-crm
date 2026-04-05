"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  Receipt, TrendingUp, Clock, XCircle, Filter,
  RotateCcw, Loader2, MapPin, BarChart2, Users,
  AlertTriangle,
} from "lucide-react";
import { StatCard, Card } from "@/components/ui/Card";
import { SectionBlock } from "@/components/ui/SectionBlock";
import { CategoryBarChart } from "@/components/finance/charts/CategoryBarChart";
import { MonthlyLineChart } from "@/components/finance/charts/MonthlyLineChart";
import { RejectionBarChart } from "@/components/finance/charts/RejectionBarChart";
import { useApiClient } from "@/lib/api-client";
import { EXPENSE_CATEGORIES } from "@/modules/finance/types";
import type {
  SummaryData,
  CategoryDataPoint,
  MonthlyDataPoint,
  EmployeeDataPoint,
  RejectionDataPoint,
  LocationDataPoint,
} from "@/modules/finance/repositories/expenseAnalytics.repository";

// GeoMap uses leaflet (window-dependent) — must be client-only
const GeoMap = dynamic(
  () => import("@/components/finance/charts/GeoMap"),
  { ssr: false, loading: () => <div className="h-[420px] animate-pulse rounded-xl bg-gray-100" /> }
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DashboardData {
  summary:    SummaryData    | null;
  categories: CategoryDataPoint[]  | null;
  monthly:    MonthlyDataPoint[]   | null;
  employees:  EmployeeDataPoint[]  | null;
  rejections: RejectionDataPoint[] | null;
  locations:  LocationDataPoint[]  | null;
}

interface Filters {
  from:     string;
  to:       string;
  category: string;
  staffId:  string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtINR(v: number) {
  if (v >= 100_000) return `₹${(v / 100_000).toFixed(1)}L`;
  if (v >= 1_000)   return `₹${(v / 1_000).toFixed(0)}K`;
  return `₹${Math.round(v)}`;
}

function currentMonthDefaults(): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const last = new Date(y, now.getMonth() + 1, 0).getDate();
  return { from: `${y}-${m}-01`, to: `${y}-${m}-${last}` };
}

function buildQS(f: Filters): string {
  const p = new URLSearchParams();
  if (f.from)     p.set("from",     f.from);
  if (f.to)       p.set("to",       f.to);
  if (f.category) p.set("category", f.category);
  if (f.staffId)  p.set("staffId",  f.staffId);
  return p.toString();
}

const EMPTY_DATA: DashboardData = {
  summary:    null,
  categories: null,
  monthly:    null,
  employees:  null,
  rejections: null,
  locations:  null,
};

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-gray-100 ${className}`} />;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ExpenseDashboard() {
  const api = useApiClient();
  const defaults = currentMonthDefaults();

  const [filters, setFilters] = useState<Filters>({
    from:     defaults.from,
    to:       defaults.to,
    category: "",
    staffId:  "",
  });

  // "pending" filters — committed to state only when user clicks Apply
  const [draft, setDraft] = useState<Filters>(filters);
  const [data, setData]       = useState<DashboardData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const fetchAll = useCallback(async (f: Filters) => {
    setLoading(true);
    setError(null);
    const qs = buildQS(f);
    try {
      const [summary, categories, monthly, employees, rejections, locations] =
        await Promise.allSettled([
          api.get<{ success: boolean; data: SummaryData }>           (`/api/expenses/analytics/summary?${qs}`),
          api.get<{ success: boolean; data: CategoryDataPoint[] }>   (`/api/expenses/analytics/category?${qs}`),
          api.get<{ success: boolean; data: MonthlyDataPoint[] }>    (`/api/expenses/analytics/monthly?${qs}`),
          api.get<{ success: boolean; data: EmployeeDataPoint[] }>   (`/api/expenses/analytics/employees?${qs}`),
          api.get<{ success: boolean; data: RejectionDataPoint[] }>  (`/api/expenses/analytics/rejections?${qs}`),
          api.get<{ success: boolean; data: LocationDataPoint[] }>   (`/api/expenses/analytics/locations?${qs}`),
        ]);

      setData({
        summary:    summary.status    === "fulfilled" ? summary.value.data        : null,
        categories: categories.status === "fulfilled" ? categories.value.data     : null,
        monthly:    monthly.status    === "fulfilled" ? monthly.value.data        : null,
        employees:  employees.status  === "fulfilled" ? employees.value.data      : null,
        rejections: rejections.status === "fulfilled" ? rejections.value.data     : null,
        locations:  locations.status  === "fulfilled" ? locations.value.data      : null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { fetchAll(filters); }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  function applyFilters() {
    setFilters(draft);
    fetchAll(draft);
  }

  function resetFilters() {
    const reset: Filters = { ...defaults, category: "", staffId: "" };
    setDraft(reset);
    setFilters(reset);
    fetchAll(reset);
  }

  const s = data.summary;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-8">

      {/* ── Filter Bar ─────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 shrink-0">
            <Filter className="h-4 w-4 text-gray-400" />
            Filters
          </div>

          {/* Date range */}
          <div className="flex items-center gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">From</label>
              <input
                type="date"
                value={draft.from}
                onChange={(e) => setDraft({ ...draft, from: e.target.value })}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-colors"
              />
            </div>
            <span className="mt-4 text-gray-400 text-xs">—</span>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">To</label>
              <input
                type="date"
                value={draft.to}
                onChange={(e) => setDraft({ ...draft, to: e.target.value })}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-colors"
              />
            </div>
          </div>

          {/* Category */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Category</label>
            <select
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-colors"
            >
              <option value="">All Categories</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Apply + Reset */}
          <div className="flex gap-2 mt-auto">
            <button
              onClick={applyFilters}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Apply
            </button>
            <button
              onClick={resetFilters}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        {loading || !s ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <StatCard
              label="Total Expenses"
              value={fmtINR(s.totalAmount)}
              sub={`${s.totalCount} expense${s.totalCount !== 1 ? "s" : ""}`}
              icon={<Receipt className="h-5 w-5" />}
              color="indigo"
            />
            <StatCard
              label="Approved"
              value={fmtINR(s.approvedAmount)}
              sub={`${s.approvedCount} approved`}
              icon={<TrendingUp className="h-5 w-5" />}
              color="green"
            />
            <StatCard
              label="Pending"
              value={fmtINR(s.pendingAmount)}
              sub={`${s.pendingCount} awaiting review`}
              icon={<Clock className="h-5 w-5" />}
              color={s.pendingCount > 0 ? "yellow" : "green"}
            />
            <StatCard
              label="Rejected"
              value={fmtINR(s.rejectedAmount)}
              sub={`${s.rejectedCount} rejected`}
              icon={<XCircle className="h-5 w-5" />}
              color={s.rejectedCount > 0 ? "red" : "indigo"}
            />
          </>
        )}
      </div>

      {/* ── Charts row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionBlock
          title="Category Breakdown"
          subtitle="Total spend grouped by expense category"
          icon={<BarChart2 className="h-4.5 w-4.5 text-indigo-600" />}
        >
          {loading || !data.categories ? (
            <Skeleton className="h-[300px]" />
          ) : (
            <CategoryBarChart data={data.categories} height={280} />
          )}
        </SectionBlock>

        <SectionBlock
          title="Monthly Trend"
          subtitle="Total vs approved vs rejected spend over time"
          icon={<TrendingUp className="h-4.5 w-4.5 text-emerald-600" />}
        >
          {loading || !data.monthly ? (
            <Skeleton className="h-[300px]" />
          ) : (
            <MonthlyLineChart data={data.monthly} height={280} />
          )}
        </SectionBlock>
      </div>

      {/* ── Employee Spend Table ───────────────────────────────────────────── */}
      <SectionBlock
        title="Employee Spend"
        subtitle="Breakdown by staff member — sorted by total spend"
        icon={<Users className="h-4.5 w-4.5 text-purple-600" />}
      >
        {loading || !data.employees ? (
          <Skeleton className="h-40" />
        ) : data.employees.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">No employee data for this period</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">#</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Employee</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Total Spend</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Approved</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Rejected</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Pending</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Expenses</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.employees.map((emp, i) => (
                  <tr key={emp.staffId} className="bg-white transition-colors hover:bg-gray-50">
                    <td className="px-5 py-3.5 text-xs text-gray-400">{i + 1}</td>
                    <td className="px-5 py-3.5 font-medium text-gray-900">{emp.name}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-gray-900">{fmtINR(emp.total)}</td>
                    <td className="px-5 py-3.5 text-right text-emerald-600 font-medium">{fmtINR(emp.approved)}</td>
                    <td className="px-5 py-3.5 text-right text-red-500 font-medium">{fmtINR(emp.rejected)}</td>
                    <td className="px-5 py-3.5 text-right text-amber-600 font-medium">{fmtINR(emp.pending)}</td>
                    <td className="px-5 py-3.5 text-right text-gray-500">{emp.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionBlock>

      {/* ── Rejection Analysis ─────────────────────────────────────────────── */}
      <SectionBlock
        title="Rejection Analysis"
        subtitle="Most common reasons for expense rejection"
        icon={<AlertTriangle className="h-4.5 w-4.5 text-red-500" />}
      >
        {loading || !data.rejections ? (
          <Skeleton className="h-52" />
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Bar chart */}
            <RejectionBarChart data={data.rejections} height={220} />

            {/* Count table */}
            {data.rejections.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-gray-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Reason</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.rejections.map((r, i) => (
                      <tr key={i} className="bg-white hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-700 max-w-xs truncate" title={r.reason}>{r.reason}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex items-center justify-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-red-200">
                            {r.count}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-400 h-[220px]">
                No rejections recorded
              </div>
            )}
          </div>
        )}
      </SectionBlock>

      {/* ── GPS Heatmap ────────────────────────────────────────────────────── */}
      <SectionBlock
        title="Expense GPS Locations"
        subtitle="Geo-heatmap of expense submissions — red markers are flagged"
        icon={<MapPin className="h-4.5 w-4.5 text-teal-600" />}
      >
        {loading || !data.locations ? (
          <Skeleton className="h-[420px]" />
        ) : (
          <div className="relative">
            <GeoMap data={data.locations} height={420} />
            <div className="mt-3 flex items-center gap-5 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-full bg-indigo-500 opacity-60" />
                Normal expense
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-full bg-red-500 opacity-70" />
                Flagged (GPS mismatch / receipt issue)
              </span>
              <span className="text-gray-400">Circle size ∝ amount</span>
            </div>
          </div>
        )}
      </SectionBlock>

    </div>
  );
}
