"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, XCircle, Clock, ChevronRight, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { getDocumentAlerts } from "@/lib/vault-api";
import type { DocumentAlertsResult, DocumentAlertSummary, WarningLevel } from "@/types/vault";

// ---------------------------------------------------------------------------
// Category emoji map
// ---------------------------------------------------------------------------

const CAT_EMOJI: Record<string, string> = {
  POLICY: "📋", CONTRACT: "📝", HANDBOOK: "📖",
  FORM: "📄", SOP: "🔧", COMPLIANCE: "✅", OTHER: "📁",
};

// ---------------------------------------------------------------------------
// Single alert row
// ---------------------------------------------------------------------------

function AlertRow({
  doc, accent,
}: {
  doc:    DocumentAlertSummary;
  accent: string;
}) {
  const emoji    = CAT_EMOJI[doc.category] ?? "📁";
  const daysText = doc.daysUntil < 0
    ? "Expired"
    : doc.daysUntil === 0
    ? "Today"
    : `${doc.daysUntil}d`;

  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className="text-sm">{emoji}</span>
      <span className="flex-1 truncate text-xs font-medium text-gray-700" title={doc.title}>
        {doc.title}
      </span>
      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold", accent)}>
        {daysText}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Alert section card
// ---------------------------------------------------------------------------

interface SectionCardProps {
  icon:      React.ReactNode;
  label:     string;
  count:     number;
  docs:      DocumentAlertSummary[];
  color:     string;
  bg:        string;
  border:    string;
  badge:     string;
  pulse?:    boolean;
  onClick:   () => void;
}

function SectionCard({
  icon, label, count, docs, color, bg, border, badge, pulse = false, onClick,
}: SectionCardProps) {
  if (count === 0) return null;

  const preview = docs.slice(0, 3);

  return (
    <button
      onClick={onClick}
      className={cn(
        "group flex flex-col gap-3 rounded-2xl border p-4 text-left transition-all",
        "hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.99]",
        bg, border
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("flex h-8 w-8 items-center justify-center rounded-xl", bg, color)}>
            {icon}
          </span>
          <div>
            <p className={cn("text-xs font-bold uppercase tracking-wider", color)}>{label}</p>
            <p className="text-[10px] text-gray-500">Click to filter</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold",
            badge,
            pulse && "animate-pulse"
          )}>
            {count}
          </span>
          <ChevronRight className={cn("h-4 w-4 transition-transform group-hover:translate-x-0.5", color)} />
        </div>
      </div>

      {/* Document list preview */}
      {preview.length > 0 && (
        <div className="divide-y divide-gray-100 rounded-xl border border-white/60 bg-white/60 px-3 py-1">
          {preview.map((doc) => (
            <AlertRow key={doc.id} doc={doc} accent={badge} />
          ))}
          {count > 3 && (
            <p className="py-1.5 text-[10px] text-gray-400">
              +{count - 3} more
            </p>
          )}
        </div>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AlertWidgetProps {
  onFilterExpiringSoon: () => void;
  onFilterCritical:     () => void;
  onFilterExpired:      () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AlertWidget({ onFilterExpiringSoon, onFilterCritical, onFilterExpired }: AlertWidgetProps) {
  const [alerts,  setAlerts]  = useState<DocumentAlertsResult | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchAlerts() {
    setLoading(true);
    try {
      const res = await getDocumentAlerts();
      setAlerts(res.data);
    } catch {
      // fail silently — vault server may be unavailable
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAlerts(); }, []);

  // No alerts at all — render nothing
  if (!loading && alerts) {
    const total = alerts.counts.critical + alerts.counts.expiringSoon + alerts.counts.expired;
    if (total === 0) return null;
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse rounded-2xl border border-gray-100 bg-gray-50 p-4 h-20" />
        ))}
      </div>
    );
  }

  if (!alerts) return null;

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <h2 className="text-sm font-bold text-gray-900">Document Expiry Alerts</h2>
        </div>
        <button
          onClick={fetchAlerts}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 active:scale-95"
        >
          <RefreshCw className="h-3 w-3" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Critical — ≤7 days (red, pulse) */}
        <SectionCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Critical"
          count={alerts.counts.critical}
          docs={alerts.critical}
          color="text-red-600"
          bg="bg-red-50"
          border="border-red-100"
          badge="bg-red-500 text-white"
          pulse={true}
          onClick={onFilterCritical}
        />

        {/* Expiring Soon — 31–90 days (amber) */}
        <SectionCard
          icon={<Clock className="h-4 w-4" />}
          label="Expiring Soon"
          count={alerts.counts.expiringSoon}
          docs={alerts.expiringSoon}
          color="text-amber-600"
          bg="bg-amber-50"
          border="border-amber-100"
          badge="bg-amber-500 text-white"
          onClick={onFilterExpiringSoon}
        />

        {/* Expired (gray/muted) */}
        <SectionCard
          icon={<XCircle className="h-4 w-4" />}
          label="Expired"
          count={alerts.counts.expired}
          docs={alerts.expired}
          color="text-gray-500"
          bg="bg-gray-50"
          border="border-gray-100"
          badge="bg-gray-500 text-white"
          onClick={onFilterExpired}
        />
      </div>
    </div>
  );
}
