"use client";

import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Search, X } from "lucide-react";
import type { ReportFilterDef } from "@/lib/reports-config";

interface Props {
  filterDefs: ReportFilterDef[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onRun: () => void;
  onReset: () => void;
  loading: boolean;
}

export function ReportFilters({ filterDefs, values, onChange, onRun, onReset, loading }: Props) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      {filterDefs.map((f) => {
        if (f.type === "select" && f.options) {
          return (
            <div key={f.key} className="w-40">
              <Select
                label={f.label}
                value={values[f.key] ?? ""}
                onChange={(e) => onChange(f.key, e.target.value)}
                options={f.options}
              />
            </div>
          );
        }
        if (f.type === "date") {
          return (
            <div key={f.key} className="w-40">
              <Input
                label={f.label}
                type="date"
                value={values[f.key] ?? ""}
                onChange={(e) => onChange(f.key, e.target.value)}
              />
            </div>
          );
        }
        return (
          <div key={f.key} className="w-40">
            <Input
              label={f.label}
              type="text"
              placeholder={`Filter by ${f.label.toLowerCase()}`}
              value={values[f.key] ?? ""}
              onChange={(e) => onChange(f.key, e.target.value)}
            />
          </div>
        );
      })}

      <div className="flex gap-2 pb-0.5">
        <Button
          variant="primary"
          size="sm"
          icon={<Search className="h-3.5 w-3.5" />}
          onClick={onRun}
          loading={loading}
        >
          Run
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={<X className="h-3.5 w-3.5" />}
          onClick={onReset}
        >
          Reset
        </Button>
      </div>
    </div>
  );
}
