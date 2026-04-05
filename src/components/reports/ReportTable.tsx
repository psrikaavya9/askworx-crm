"use client";

import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import type { ReportColumn } from "@/lib/reports-config";

function fmtINR(value: number): string {
  if (!value && value !== 0) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function fmtDatetime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

function formatCell(col: ReportColumn, raw: unknown): React.ReactNode {
  if (raw === null || raw === undefined || raw === "") return <span className="text-gray-300">—</span>;

  if (col.format === "badge" && col.badgeMap) {
    const key = String(raw);
    const variant = col.badgeMap[key] ?? "gray";
    return <Badge variant={variant}>{key}</Badge>;
  }

  if (col.format === "currency") return fmtINR(Number(raw));
  if (col.format === "date") return fmtDate(String(raw));
  if (col.format === "datetime") return fmtDatetime(String(raw));
  if (col.format === "percent") return `${raw}%`;
  if (col.format === "number") return Number(raw).toLocaleString("en-IN");

  return String(raw);
}

interface ReportTableProps {
  columns: ReportColumn[];
  data: Record<string, unknown>[];
  loading?: boolean;
}

export function ReportTable({ columns, data, loading }: ReportTableProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-gray-100" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white py-16">
        <p className="text-sm text-gray-400">No data found for the selected filters.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-md">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-500",
                    col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                  )}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.map((row, i) => (
              <tr key={i} className="bg-white hover:bg-gray-50 transition-colors">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      "px-5 py-4 text-gray-700",
                      col.align === "right" ? "text-right tabular-nums" : col.align === "center" ? "text-center" : "text-left"
                    )}
                  >
                    {formatCell(col, row[col.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
