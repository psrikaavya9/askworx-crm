"use client";

import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { ReportColumn } from "@/lib/reports-config";

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

function toCSV(columns: ReportColumn[], data: Record<string, unknown>[]): string {
  const escape = (v: unknown): string => {
    const s = v === null || v === undefined ? "" : String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const header = columns.map((c) => escape(c.label)).join(",");
  const rows = data.map((row) => columns.map((c) => escape(row[c.key])).join(","));
  return [header, ...rows].join("\r\n");
}

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  columns: ReportColumn[];
  data: Record<string, unknown>[];
  reportTitle: string;
  disabled?: boolean;
}

export function ExportButtons({ columns, data, reportTitle, disabled }: Props) {
  const slug = reportTitle.toLowerCase().replace(/\s+/g, "-");

  function exportCSV() {
    const csv = toCSV(columns, data);
    downloadBlob(csv, `${slug}-${new Date().toISOString().slice(0, 10)}.csv`, "text/csv;charset=utf-8;");
  }

  function exportPDF() {
    window.print();
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        icon={<Download className="h-3.5 w-3.5" />}
        onClick={exportCSV}
        disabled={disabled || data.length === 0}
      >
        CSV
      </Button>
      <Button
        variant="secondary"
        size="sm"
        icon={<Printer className="h-3.5 w-3.5" />}
        onClick={exportPDF}
        disabled={disabled || data.length === 0}
      >
        Print / PDF
      </Button>
    </div>
  );
}
