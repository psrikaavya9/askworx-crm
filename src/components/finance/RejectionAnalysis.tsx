"use client";

import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { AlertTriangle, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useApiClient } from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RejectionRow {
  reason: string;
  count:  number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Truncate reason text for Y-axis labels */
function shortLabel(s: string, max = 30): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

/** Bar fill — most common: red, runner-up: orange, rest: slate */
function barFill(index: number): string {
  if (index === 0) return "#ef4444";
  if (index === 1) return "#f97316";
  return "#94a3b8";
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function Skeleton() {
  return (
    <div className="space-y-2 pt-2">
      <div className="h-5 w-1/3 animate-pulse rounded bg-gray-100" />
      <div className="mt-4 h-[280px] animate-pulse rounded-xl bg-gray-100" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------

interface TooltipPayload {
  payload?: RejectionRow;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.[0]?.payload) return null;
  const { reason, count } = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-md text-xs">
      <p className="mb-1 max-w-[240px] font-medium text-gray-800 leading-snug">{reason}</p>
      <p className="font-bold text-red-600">{count} rejection{count !== 1 ? "s" : ""}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function RejectionAnalysis() {
  const api = useApiClient();
  const [data, setData]       = useState<RejectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    api
      .get<RejectionRow[]>("/api/expenses/rejections")
      .then(setData)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load rejection data")
      )
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total   = data.reduce((sum, r) => sum + r.count, 0);
  const topRow  = data[0] ?? null;

  return (
    <Card>
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Rejection Analysis</h2>
          <p className="mt-0.5 text-xs text-gray-500">All-time · manual and auto-rejected</p>
        </div>

        {total > 0 && (
          <div className="flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">
            <TrendingDown className="h-3.5 w-3.5" />
            {total} total rejection{total !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Most common reason callout */}
      {!loading && !error && topRow && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <div className="text-xs leading-snug">
            <span className="font-semibold text-red-700">Most common: </span>
            <span className="text-red-600">{topRow.reason}</span>
            <span className="ml-1 text-red-400">({topRow.count}×)</span>
          </div>
        </div>
      )}

      {/* Body */}
      {loading && <Skeleton />}

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
      )}

      {!loading && !error && data.length === 0 && (
        <p className="py-10 text-center text-sm text-gray-400">No rejections recorded.</p>
      )}

      {!loading && !error && data.length > 0 && (
        <ResponsiveContainer width="100%" height={Math.max(200, data.length * 44)}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 24, left: 8, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: "#6b7280" }}
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="reason"
              tick={{ fontSize: 10, fill: "#6b7280" }}
              tickFormatter={shortLabel}
              width={200}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc" }} />
            <Bar dataKey="count" name="Count" radius={[0, 4, 4, 0]} maxBarSize={26}>
              {data.map((_, i) => (
                <Cell key={i} fill={barFill(i)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
