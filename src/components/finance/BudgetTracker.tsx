"use client";

import { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useApiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BudgetRow {
  category:  string;
  limit:     number;
  used:      number;
  remaining: number;
  percent:   number;
  alert:     boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style:               "currency",
    currency:            "INR",
    maximumFractionDigits: 0,
  }).format(Math.abs(n));

function barColor(percent: number): { bar: string; text: string; bg: string } {
  if (percent > 80) return { bar: "bg-red-500",    text: "text-red-600",    bg: "bg-red-50"    };
  if (percent > 60) return { bar: "bg-amber-400",  text: "text-amber-600",  bg: "bg-amber-50"  };
  return               { bar: "bg-emerald-500", text: "text-emerald-600", bg: "bg-emerald-50" };
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function Skeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-[72px] animate-pulse rounded-xl bg-gray-100" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single budget row
// ---------------------------------------------------------------------------

function BudgetRow({ row }: { row: BudgetRow }) {
  const { bar, text, bg } = barColor(row.percent);
  const capped             = Math.min(row.percent, 100);
  const overBudget         = row.remaining < 0;

  return (
    <div className={cn("rounded-xl border border-gray-200 bg-white p-4 shadow-sm", row.alert && "border-red-200")}>
      {/* Header row */}
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {row.alert && (
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" aria-label="Over 80% used" />
          )}
          <span className="text-sm font-semibold text-gray-800">{row.category}</span>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-500">
            {fmt(row.used)} <span className="text-gray-400">of</span> {fmt(row.limit)}
          </span>
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums", bg, text)}>
            {row.percent}%
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={cn("h-full rounded-full transition-all duration-500", bar)}
          style={{ width: `${capped}%` }}
        />
      </div>

      {/* Remaining / over-budget */}
      <p className={cn("mt-1.5 text-right text-[11px] font-medium", overBudget ? "text-red-500" : "text-gray-400")}>
        {overBudget
          ? `${fmt(row.remaining)} over budget`
          : `${fmt(row.remaining)} remaining`}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function BudgetTracker() {
  const api = useApiClient();
  const [rows, setRows]     = useState<BudgetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    api
      .get<BudgetRow[]>("/api/expenses/budget")
      .then((data) => {
        // Sort by highest percent usage first
        setRows([...data].sort((a, b) => b.percent - a.percent));
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load budget data")
      )
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const alertCount = rows.filter((r) => r.alert).length;

  return (
    <Card>
      {/* Card header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Budget vs Actual</h2>
          <p className="mt-0.5 text-xs text-gray-500">Approved expenses · current month</p>
        </div>
        {alertCount > 0 && (
          <div className="flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            {alertCount} {alertCount === 1 ? "category" : "categories"} over 80%
          </div>
        )}
      </div>

      {/* Body */}
      {loading && <Skeleton />}

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
      )}

      {!loading && !error && rows.length === 0 && (
        <p className="py-8 text-center text-sm text-gray-400">
          No budget limits configured yet.
        </p>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="space-y-3">
          {rows.map((row) => (
            <BudgetRow key={row.category} row={row} />
          ))}
        </div>
      )}
    </Card>
  );
}
