"use client";

import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DocumentCategory, DocumentStatus, WarningLevel } from "@/types/vault";

const CATEGORIES: { value: DocumentCategory | ""; label: string }[] = [
  { value: "",           label: "All Categories" },
  { value: "POLICY",     label: "Policy" },
  { value: "CONTRACT",   label: "Contract" },
  { value: "HANDBOOK",   label: "Handbook" },
  { value: "FORM",       label: "Form" },
  { value: "SOP",        label: "SOP" },
  { value: "COMPLIANCE", label: "Compliance" },
  { value: "OTHER",      label: "Other" },
];

const STATUSES: { value: DocumentStatus | ""; label: string }[] = [
  { value: "",         label: "All Statuses" },
  { value: "ACTIVE",   label: "Active" },
  { value: "EXPIRED",  label: "Expired" },
  { value: "ARCHIVED", label: "Archived" },
];

const WARNING_LEVELS: { value: WarningLevel | ""; label: string }[] = [
  { value: "",       label: "All Expiry" },
  { value: "high",   label: "⚠️ Critical (≤7d)" },
  { value: "medium", label: "🟠 Due Soon (≤30d)" },
  { value: "low",    label: "🟡 Expiring (≤90d)" },
  { value: "none",   label: "✅ Safe / No Expiry" },
];

interface FilterBarProps {
  search:       string;
  category:     DocumentCategory | "";
  status:       DocumentStatus   | "";
  warningLevel: WarningLevel     | "";
  onSearch:      (v: string)               => void;
  onCategory:    (v: DocumentCategory | "") => void;
  onStatus:      (v: DocumentStatus   | "") => void;
  onWarningLevel:(v: WarningLevel     | "") => void;
  onClear:       () => void;
  total?:        number;
}

export function FilterBar({
  search, category, status, warningLevel,
  onSearch, onCategory, onStatus, onWarningLevel, onClear,
  total,
}: FilterBarProps) {
  const hasFilters = search || category || status || warningLevel;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
      {/* Search */}
      <div className="relative flex-1">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search documents…"
          className={cn(
            "w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900",
            "shadow-sm placeholder:text-gray-400",
            "transition-all focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-100"
          )}
        />
      </div>

      {/* Category */}
      <select
        value={category}
        onChange={(e) => onCategory(e.target.value as DocumentCategory | "")}
        className={cn(
          "rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700",
          "shadow-sm transition-all focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-100",
          "cursor-pointer"
        )}
      >
        {CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>{c.label}</option>
        ))}
      </select>

      {/* Status */}
      <select
        value={status}
        onChange={(e) => onStatus(e.target.value as DocumentStatus | "")}
        className={cn(
          "rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700",
          "shadow-sm transition-all focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-100",
          "cursor-pointer"
        )}
      >
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>

      {/* Warning Level / Expiry */}
      <select
        value={warningLevel}
        onChange={(e) => onWarningLevel(e.target.value as WarningLevel | "")}
        className={cn(
          "rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700",
          "shadow-sm transition-all focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-100",
          "cursor-pointer",
          warningLevel === "high"   && "border-red-300 text-red-700",
          warningLevel === "medium" && "border-orange-300 text-orange-700",
          warningLevel === "low"    && "border-amber-300 text-amber-700"
        )}
      >
        {WARNING_LEVELS.map((w) => (
          <option key={w.value} value={w.value}>{w.label}</option>
        ))}
      </select>

      {/* Clear / count */}
      <div className="flex shrink-0 items-center gap-2">
        {total !== undefined && (
          <span className="hidden whitespace-nowrap rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-gray-500 shadow-sm sm:block">
            {total} doc{total !== 1 ? "s" : ""}
          </span>
        )}
        {hasFilters && (
          <button
            onClick={onClear}
            className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs font-semibold text-gray-600 shadow-sm transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </div>
    </div>
  );
}
