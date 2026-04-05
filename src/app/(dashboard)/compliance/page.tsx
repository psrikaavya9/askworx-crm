"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck, RefreshCw, CheckCircle2, Clock, AlertTriangle, XCircle,
} from "lucide-react";
import { useApiClient } from "@/lib/api-client";
import { ComplianceAlertSummary } from "@/components/compliance/ComplianceAlertSummary";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ComplianceType      = "INTERNAL" | "STATUTORY";
type ComplianceFrequency = "MONTHLY" | "QUARTERLY" | "YEARLY";
type ComplianceStatus    = "PENDING" | "UPCOMING" | "OVERDUE" | "COMPLETED";

interface ComplianceItem {
  id:           string;
  title:        string;
  type:         ComplianceType;
  frequency:    ComplianceFrequency;
  status:       ComplianceStatus;
  nextDueDate:  string;
  lastDoneDate: string | null;
  notes:        string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

const STATUS_CONFIG: Record<ComplianceStatus, { label: string; classes: string; icon: React.ReactNode }> = {
  OVERDUE:   { label: "Overdue",   classes: "bg-red-500/20 text-red-300 border-red-500/30",         icon: <XCircle     className="h-3 w-3" /> },
  UPCOMING:  { label: "Due Soon",  classes: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30", icon: <AlertTriangle className="h-3 w-3" /> },
  PENDING:   { label: "Pending",   classes: "bg-blue-500/20 text-blue-300 border-blue-500/30",       icon: <Clock       className="h-3 w-3" /> },
  COMPLETED: { label: "Completed", classes: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30", icon: <CheckCircle2 className="h-3 w-3" /> },
};

const FREQ_LABEL: Record<ComplianceFrequency, string> = {
  MONTHLY: "Monthly", QUARTERLY: "Quarterly", YEARLY: "Yearly",
};

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: ComplianceStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${cfg.classes}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CompliancePage() {
  const api = useApiClient();

  const [items,   setItems]   = useState<ComplianceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<ComplianceStatus | "">("");
  const [typeFilter,   setTypeFilter]   = useState<ComplianceType | "">("");
  const [markingId,    setMarkingId]    = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (typeFilter)   params.set("type",   typeFilter);
      const data = await api.get<ComplianceItem[]>(`/api/compliance?${params}`);
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load compliance items");
    } finally {
      setLoading(false);
    }
  }, [api, statusFilter, typeFilter]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleMarkComplete = useCallback(async (id: string) => {
    setMarkingId(id);
    try {
      await api.patch(`/api/compliance/${id}`, { markComplete: true });
      await fetchItems();
    } catch {
      // ignore — item will keep its current state
    } finally {
      setMarkingId(null);
    }
  }, [api, fetchItems]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      className="min-h-screen px-4 pb-12 pt-2"
      style={{ background: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)" }}
    >
      {/* ── Heading ── */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Compliance Tracker</h1>
          <p className="mt-0.5 text-sm text-white/50">
            Track internal and statutory compliance obligations
          </p>
        </div>
        <button
          onClick={fetchItems}
          className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white/70 backdrop-blur-sm transition-all hover:border-white/30 hover:bg-white/10 active:scale-95"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* ── Alert summary (the new component) ── */}
      <div className="mb-6">
        <ComplianceAlertSummary />
      </div>

      {/* ── Filters ── */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ComplianceStatus | "")}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white backdrop-blur-sm focus:border-violet-400/50 focus:outline-none"
        >
          <option value="" className="bg-gray-900">All Statuses</option>
          <option value="OVERDUE"   className="bg-gray-900">Overdue</option>
          <option value="UPCOMING"  className="bg-gray-900">Due Soon</option>
          <option value="PENDING"   className="bg-gray-900">Pending</option>
          <option value="COMPLETED" className="bg-gray-900">Completed</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as ComplianceType | "")}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white backdrop-blur-sm focus:border-violet-400/50 focus:outline-none"
        >
          <option value=""           className="bg-gray-900">All Types</option>
          <option value="INTERNAL"   className="bg-gray-900">Internal</option>
          <option value="STATUTORY"  className="bg-gray-900">Statutory</option>
        </select>

        {(statusFilter || typeFilter) && (
          <button
            onClick={() => { setStatusFilter(""); setTypeFilter(""); }}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-medium text-white/60 backdrop-blur-sm transition-all hover:border-white/20 hover:text-white active:scale-95"
          >
            Clear
          </button>
        )}

        <p className="ml-auto text-xs text-white/40">
          {loading ? "Loading…" : `${items.length} item${items.length !== 1 ? "s" : ""}`}
        </p>
      </div>

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm">
        {/* Header */}
        <div className="hidden grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 border-b border-white/10 px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-white/40 lg:grid">
          <span>Title</span>
          <span>Type</span>
          <span>Frequency</span>
          <span>Next Due</span>
          <span>Status</span>
          <span></span>
        </div>

        {loading ? (
          <div className="space-y-0">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="grid animate-pulse grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 border-b border-white/5 px-5 py-4">
                <div className="h-3.5 w-3/4 rounded-full bg-white/10" />
                <div className="h-3 w-16 rounded-full bg-white/10" />
                <div className="h-3 w-20 rounded-full bg-white/10" />
                <div className="h-3 w-20 rounded-full bg-white/10" />
                <div className="h-5 w-20 rounded-full bg-white/10" />
                <div className="h-7 w-28 rounded-lg bg-white/10" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <XCircle className="mb-3 h-10 w-10 text-red-400" />
            <p className="text-sm font-semibold text-white/70">{error}</p>
            <button
              onClick={fetchItems}
              className="mt-4 flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white/80 transition-all hover:bg-white/15 active:scale-95"
            >
              <RefreshCw className="h-4 w-4" /> Retry
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <ShieldCheck className="mb-3 h-12 w-12 text-violet-400" />
            <p className="text-sm font-semibold text-white/70">No compliance items found</p>
            <p className="mt-1 text-xs text-white/30">Try adjusting your filters</p>
          </div>
        ) : (
          <div>
            {items.map((item) => {
              const days     = daysUntil(item.nextDueDate);
              const isOverdue = item.status === "OVERDUE";

              return (
                <div
                  key={item.id}
                  className={`grid grid-cols-1 gap-2 border-b border-white/5 px-5 py-4 transition-colors last:border-0 hover:bg-white/5 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] lg:items-center lg:gap-4
                    ${isOverdue ? "bg-red-900/10" : item.status === "UPCOMING" ? "bg-yellow-900/5" : ""}`}
                >
                  {/* Title */}
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: "linear-gradient(135deg, #7c3aed40 0%, #5c64f640 100%)" }}>
                      <ShieldCheck className="h-4 w-4 text-violet-300" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white/90">{item.title}</p>
                      {item.notes && (
                        <p className="mt-0.5 truncate text-[11px] text-white/40">{item.notes}</p>
                      )}
                    </div>
                  </div>

                  {/* Type */}
                  <span className="inline-block rounded-lg bg-white/8 px-2 py-0.5 text-[11px] font-semibold text-white/60">
                    {item.type === "STATUTORY" ? "Statutory" : "Internal"}
                  </span>

                  {/* Frequency */}
                  <span className="text-sm text-white/60">{FREQ_LABEL[item.frequency]}</span>

                  {/* Next due */}
                  <div>
                    <p className={`text-sm font-medium ${isOverdue ? "text-red-300" : item.status === "UPCOMING" ? "text-yellow-300" : "text-white/60"}`}>
                      {formatDate(item.nextDueDate)}
                    </p>
                    {days >= 0 && days <= 30 && (
                      <p className="mt-0.5 text-[10px] text-white/30">{days}d left</p>
                    )}
                    {days < 0 && (
                      <p className="mt-0.5 text-[10px] text-red-400">{Math.abs(days)}d overdue</p>
                    )}
                  </div>

                  {/* Status */}
                  <StatusBadge status={item.status} />

                  {/* Action */}
                  {item.status !== "COMPLETED" && (
                    <button
                      onClick={() => handleMarkComplete(item.id)}
                      disabled={markingId === item.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-300 transition-all hover:bg-emerald-500/20 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {markingId === item.id
                        ? <RefreshCw className="h-3 w-3 animate-spin" />
                        : <CheckCircle2 className="h-3 w-3" />}
                      Mark Done
                    </button>
                  )}
                  {item.status === "COMPLETED" && (
                    <span className="text-[11px] text-white/30">
                      Done {formatDate(item.lastDoneDate)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
