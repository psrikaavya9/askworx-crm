"use client";

import { useState, useCallback } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ReportFilters } from "./ReportFilters";
import { ReportTable } from "./ReportTable";
import { ExportButtons } from "./ExportButtons";
import type { ReportMeta } from "@/lib/reports-config";
import { CATEGORY_BADGE_COLOR } from "@/lib/reports-config";

interface ReportResult {
  data: Record<string, unknown>[];
  total: number;
  generatedAt: string;
  summary: Record<string, number | string>;
}

interface Props {
  report: ReportMeta;
}

export function ReportViewer({ report }: Props) {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      for (const [key, val] of Object.entries(filters)) {
        if (val) params.set(key, val);
      }
      const res = await fetch(`${report.endpoint}?${params.toString()}`);
      if (!res.ok) throw new Error("Report generation failed");
      const data = await res.json();
      setResult(data as ReportResult);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [report.endpoint, filters]);

  function handleFilterChange(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function handleReset() {
    setFilters({});
    setResult(null);
    setError(null);
  }

  const badgeColor = CATEGORY_BADGE_COLOR[report.category];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 print:p-0">
      {/* Back link */}
      <Link
        href="/reports"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors print:hidden"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All Reports
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between print:block">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-gray-900">{report.title}</h1>
            <Badge variant={badgeColor}>{report.category}</Badge>
          </div>
          <p className="mt-1 text-sm text-gray-500">{report.description}</p>
        </div>
        {result && (
          <div className="print:hidden">
            <ExportButtons
              columns={report.columns}
              data={result.data}
              reportTitle={report.title}
            />
          </div>
        )}
      </div>

      {/* Filters */}
      <Card className="print:hidden">
        <ReportFilters
          filterDefs={report.filters}
          values={filters}
          onChange={handleFilterChange}
          onRun={runReport}
          onReset={handleReset}
          loading={loading}
        />
      </Card>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Summary cards */}
          {Object.keys(result.summary).length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 print:grid-cols-4">
              {Object.entries(result.summary).map(([key, value]) => (
                <Card key={key}>
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500 capitalize">
                    {key.replace(/([A-Z])/g, " $1").trim()}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
                </Card>
              ))}
            </div>
          )}

          {/* Meta row */}
          <div className="flex items-center justify-between text-xs text-slate-400 print:block">
            <span className="font-medium">{result.total} record{result.total !== 1 ? "s" : ""}</span>
            <span>Generated: {new Date(result.generatedAt).toLocaleString("en-IN")}</span>
          </div>

          {/* Table */}
          <ReportTable
            columns={report.columns}
            data={result.data}
            loading={loading}
          />
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && !error && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white py-20">
          <p className="text-sm font-semibold text-gray-500">Set filters and click Run to generate the report</p>
          <p className="mt-1 text-xs text-gray-400">Leave filters empty to see all data</p>
        </div>
      )}

      {/* Print-only header */}
      <div className="hidden print:block print:mb-4">
        <h2 className="text-lg font-bold">{report.title} — ASKworX</h2>
        <p className="text-xs text-slate-500">
          Generated: {new Date().toLocaleString("en-IN")}
        </p>
      </div>
    </div>
  );
}
