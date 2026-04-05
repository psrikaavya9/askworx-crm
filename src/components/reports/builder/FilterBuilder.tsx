"use client";

import { Plus, Trash2 } from "lucide-react";
import type { FieldDef, FilterCondition } from "@/modules/reports/types/builder";
import { OPERATOR_LABELS } from "@/lib/builder-config";

interface Props {
  fields: FieldDef[];
  filters: FilterCondition[];
  onChange: (filters: FilterCondition[]) => void;
}

const EMPTY_FILTER: FilterCondition = { field: "", operator: "eq", value: "" };

export function FilterBuilder({ fields, filters, onChange }: Props) {
  const filterableFields = fields.filter((f) => f.filterable);

  function addFilter() {
    const first = filterableFields[0];
    if (!first) return;
    onChange([
      ...filters,
      { field: first.key, operator: first.operators?.[0] ?? "eq", value: "" },
    ]);
  }

  function removeFilter(idx: number) {
    onChange(filters.filter((_, i) => i !== idx));
  }

  function updateFilter(idx: number, patch: Partial<FilterCondition>) {
    const next = filters.map((f, i) => {
      if (i !== idx) return f;
      const updated = { ...f, ...patch };
      // Reset operator when field changes
      if (patch.field && patch.field !== f.field) {
        const fieldDef = filterableFields.find((fd) => fd.key === patch.field);
        updated.operator = fieldDef?.operators?.[0] ?? "eq";
        updated.value = "";
      }
      return updated;
    });
    onChange(next);
  }

  if (filterableFields.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic">No filterable fields for this module.</p>
    );
  }

  return (
    <div className="space-y-3">
      {filters.length === 0 && (
        <p className="text-sm text-gray-400 italic">No filters — all records will be returned.</p>
      )}

      {filters.map((filter, idx) => {
        const fieldDef = filterableFields.find((f) => f.key === filter.field);
        const ops = fieldDef?.operators ?? ["eq"];

        return (
          <div key={idx} className="flex items-center gap-2 flex-wrap">
            {/* Field selector */}
            <select
              value={filter.field}
              onChange={(e) => updateFilter(idx, { field: e.target.value })}
              className="flex-1 min-w-[140px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {filterableFields.map((f) => (
                <option key={f.key} value={f.key}>{f.label}</option>
              ))}
            </select>

            {/* Operator selector */}
            <select
              value={filter.operator}
              onChange={(e) => updateFilter(idx, { operator: e.target.value as FilterCondition["operator"] })}
              className="w-44 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ops.map((op) => (
                <option key={op} value={op}>{OPERATOR_LABELS[op] ?? op}</option>
              ))}
            </select>

            {/* Value input */}
            {fieldDef?.type === "enum" && fieldDef.enumValues ? (
              <select
                value={filter.value}
                onChange={(e) => updateFilter(idx, { value: e.target.value })}
                className="flex-1 min-w-[120px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select…</option>
                {fieldDef.enumValues.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            ) : fieldDef?.type === "date" || fieldDef?.type === "datetime" ? (
              <input
                type="date"
                value={filter.value}
                onChange={(e) => updateFilter(idx, { value: e.target.value })}
                className="flex-1 min-w-[140px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <input
                type={fieldDef?.type === "number" || fieldDef?.type === "decimal" ? "number" : "text"}
                value={filter.value}
                onChange={(e) => updateFilter(idx, { value: e.target.value })}
                placeholder="Value…"
                className="flex-1 min-w-[120px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}

            <button
              type="button"
              onClick={() => removeFilter(idx)}
              className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 size={16} />
            </button>
          </div>
        );
      })}

      <button
        type="button"
        onClick={addFilter}
        className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
      >
        <Plus size={15} />
        Add filter
      </button>
    </div>
  );
}
