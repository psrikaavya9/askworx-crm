"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck, AlertTriangle, XCircle, Bell,
  RefreshCw, Search, ChevronLeft, ChevronRight,
  FileText, ExternalLink,
} from "lucide-react";
import { listDocuments, getDocumentAlerts, getAckStatus } from "@/lib/vault-api";
import type {
  HrDocument, DocumentAlertsResult, DocumentCategory, WarningLevel,
} from "@/types/vault";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  POLICY:     "Policy",
  CONTRACT:   "Contract",
  HANDBOOK:   "Handbook",
  FORM:       "Form",
  SOP:        "SOP",
  COMPLIANCE: "Compliance",
  OTHER:      "Other",
};

// ---------------------------------------------------------------------------
// Status chip
// ---------------------------------------------------------------------------

function StatusChip({ doc }: { doc: HrDocument }) {
  const days = daysUntil(doc.expiresAt);

  if (doc.status === "EXPIRED" || (days !== null && days < 0)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2.5 py-0.5 text-[11px] font-bold text-red-300">
        <XCircle className="h-3 w-3" /> Expired
      </span>
    );
  }
  if (doc.warningLevel === "high" || (days !== null && days <= 7)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/20 px-2.5 py-0.5 text-[11px] font-bold text-orange-300">
        <AlertTriangle className="h-3 w-3" /> Critical
      </span>
    );
  }
  if (doc.warningLevel === "low" || doc.warningLevel === "medium" || (days !== null && days <= 30)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/20 px-2.5 py-0.5 text-[11px] font-bold text-yellow-300">
        <AlertTriangle className="h-3 w-3" /> Expiring Soon
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
      <ShieldCheck className="h-3 w-3" /> Safe
    </span>
  );
}

// ---------------------------------------------------------------------------
// Ack progress cell
// ---------------------------------------------------------------------------

function AckProgress({ documentId, requiresAck }: { documentId: string; requiresAck: boolean }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!requiresAck) return;
    getAckStatus(documentId)
      .then((res) => setCount(res.data.acknowledgedCount))
      .catch(() => setCount(0));
  }, [documentId, requiresAck]);

  if (!requiresAck) {
    return <span className="text-white/30 text-xs">—</span>;
  }
  if (count === null) {
    return <span className="text-white/30 text-xs animate-pulse">…</span>;
  }
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-violet-400 transition-all"
          style={{ width: count > 0 ? "60%" : "0%" }}
        />
      </div>
      <span className="text-xs font-medium text-white/60">{count} ack</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary card
// ---------------------------------------------------------------------------

interface SummaryCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | null;
  loading: boolean;
  accent: string;       // tailwind text color class
  glowColor: string;    // inline hex for glow div
  active?: boolean;
  onClick?: () => void;
}

function SummaryCard({
  icon, label, value, loading, accent, glowColor, active, onClick,
}: SummaryCardProps) {
  return (
    <button
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl border p-5 text-left transition-all hover:-translate-y-0.5 active:scale-[0.98] w-full
        ${active
          ? "border-white/30 bg-white/10 backdrop-blur-sm shadow-lg"
          : "border-white/10 bg-white/5 backdrop-blur-sm hover:border-white/20 hover:bg-white/8"}`}
    >
      {/* glow */}
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-20 blur-2xl"
        style={{ background: glowColor }}
      />
      <div className={`mb-3 ${accent}`}>{icon}</div>
      {loading ? (
        <div className="h-8 w-16 animate-pulse rounded-lg bg-white/10" />
      ) : (
        <p className="text-3xl font-extrabold text-white">{value ?? 0}</p>
      )}
      <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-white/50">{label}</p>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const PAGE_SIZE = 15;

export default function ComplianceDashboardPage() {
  const [docs, setDocs]             = useState<HrDocument[]>([]);
  const [totalDocs, setTotalDocs]   = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage]             = useState(1);
  const [docsLoading, setDocsLoading] = useState(true);
  const [docsError, setDocsError]   = useState<string | null>(null);

  const [alerts, setAlerts]           = useState<DocumentAlertsResult | null>(null);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [pendingAck, setPendingAck]   = useState<number | null>(null);

  const [search, setSearch]           = useState("");
  const [categoryFilter, setCategoryFilter] = useState<DocumentCategory | "">("");
  const [warningFilter, setWarningFilter]   = useState<WarningLevel | "">("");

  // ---------------------------------------------------------------------------
  // Fetch alerts + pending-ack count
  // ---------------------------------------------------------------------------
  const fetchAlerts = useCallback(async () => {
    setAlertsLoading(true);
    try {
      const [alertRes, ackRes] = await Promise.all([
        getDocumentAlerts(),
        listDocuments({ requiresAck: true, limit: 1 }),
      ]);
      setAlerts(alertRes.data);
      setPendingAck((ackRes as { meta: { total: number } }).meta.total);
    } catch {
      // fail silently
    } finally {
      setAlertsLoading(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Fetch documents (filtered)
  // ---------------------------------------------------------------------------
  const fetchDocs = useCallback(async () => {
    setDocsLoading(true);
    setDocsError(null);
    try {
      const res = await listDocuments({
        search:       search       || undefined,
        category:     categoryFilter || undefined,
        warningLevel: warningFilter  || undefined,
        page,
        limit: PAGE_SIZE,
      });
      setDocs(res.data);
      setTotalDocs(res.meta.total);
      setTotalPages(res.meta.totalPages);
    } catch (err) {
      setDocsError(err instanceof Error ? err.message : "Failed to load documents");
    } finally {
      setDocsLoading(false);
    }
  }, [search, categoryFilter, warningFilter, page]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);
  useEffect(() => { fetchDocs();   }, [fetchDocs]);
  useEffect(() => { setPage(1);    }, [search, categoryFilter, warningFilter]);

  // ---------------------------------------------------------------------------
  // Total doc count for "Total Documents" card
  // ---------------------------------------------------------------------------
  const totalCount = alerts
    ? (totalDocs > 0 ? totalDocs : null)
    : null;

  const expiredCount     = alerts?.counts.expired    ?? null;
  const expiringSoonCount = (alerts ? (alerts.counts.expiringSoon + alerts.counts.critical) : null);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div
      className="min-h-screen px-4 pb-12 pt-2"
      style={{
        background: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
      }}
    >
      {/* ── Page heading ── */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Compliance Dashboard</h1>
          <p className="mt-0.5 text-sm text-white/50">
            Document expiry, acknowledgements & policy compliance
          </p>
        </div>
        <button
          onClick={() => { fetchAlerts(); fetchDocs(); }}
          className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white/70 backdrop-blur-sm transition-all hover:border-white/30 hover:bg-white/10 active:scale-95"
        >
          <RefreshCw className={`h-4 w-4 ${(alertsLoading || docsLoading) ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* ── Summary cards ── */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard
          icon={<FileText className="h-6 w-6" />}
          label="Total Documents"
          value={docsLoading ? null : totalDocs}
          loading={docsLoading}
          accent="text-violet-400"
          glowColor="#7c3aed"
          active={!warningFilter && !categoryFilter}
          onClick={() => { setWarningFilter(""); setCategoryFilter(""); }}
        />
        <SummaryCard
          icon={<AlertTriangle className="h-6 w-6" />}
          label="Expiring Soon"
          value={expiringSoonCount}
          loading={alertsLoading}
          accent="text-yellow-400"
          glowColor="#f59e0b"
          active={warningFilter === "low"}
          onClick={() => setWarningFilter(warningFilter === "low" ? "" : "low")}
        />
        <SummaryCard
          icon={<XCircle className="h-6 w-6" />}
          label="Expired"
          value={expiredCount}
          loading={alertsLoading}
          accent="text-red-400"
          glowColor="#ef4444"
          active={warningFilter === "high"}
          onClick={() => setWarningFilter(warningFilter === "high" ? "" : "high")}
        />
        <SummaryCard
          icon={<Bell className="h-6 w-6" />}
          label="Require Acknowledgement"
          value={pendingAck}
          loading={alertsLoading}
          accent="text-blue-400"
          glowColor="#3b82f6"
        />
      </div>

      {/* ── Alert banners ── */}
      {alerts && alerts.counts.critical > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 backdrop-blur-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-400" />
          <p className="text-sm font-medium text-red-300">
            <span className="font-bold">{alerts.counts.critical} document{alerts.counts.critical !== 1 ? "s" : ""}</span>
            {" "}expiring within 7 days — immediate action required.
          </p>
        </div>
      )}
      {alerts && alerts.counts.expired > 0 && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 backdrop-blur-sm">
          <XCircle className="h-5 w-5 shrink-0 text-orange-400" />
          <p className="text-sm font-medium text-orange-300">
            <span className="font-bold">{alerts.counts.expired} expired document{alerts.counts.expired !== 1 ? "s" : ""}</span>
            {" "}need to be renewed or archived.
          </p>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            placeholder="Search documents…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-4 text-sm text-white placeholder-white/30 backdrop-blur-sm focus:border-violet-400/50 focus:outline-none focus:ring-1 focus:ring-violet-400/30"
          />
        </div>

        {/* Category */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as DocumentCategory | "")}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white backdrop-blur-sm focus:border-violet-400/50 focus:outline-none focus:ring-1 focus:ring-violet-400/30"
        >
          <option value="" className="bg-gray-900">All Categories</option>
          {(Object.keys(CATEGORY_LABELS) as DocumentCategory[]).map((c) => (
            <option key={c} value={c} className="bg-gray-900">{CATEGORY_LABELS[c]}</option>
          ))}
        </select>

        {/* Warning level */}
        <select
          value={warningFilter}
          onChange={(e) => setWarningFilter(e.target.value as WarningLevel | "")}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white backdrop-blur-sm focus:border-violet-400/50 focus:outline-none focus:ring-1 focus:ring-violet-400/30"
        >
          <option value="" className="bg-gray-900">All Statuses</option>
          <option value="none"   className="bg-gray-900">Safe</option>
          <option value="low"    className="bg-gray-900">Expiring Soon</option>
          <option value="medium" className="bg-gray-900">Medium Risk</option>
          <option value="high"   className="bg-gray-900">Critical</option>
        </select>

        {(search || categoryFilter || warningFilter) && (
          <button
            onClick={() => { setSearch(""); setCategoryFilter(""); setWarningFilter(""); }}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-medium text-white/60 backdrop-blur-sm transition-all hover:border-white/20 hover:text-white active:scale-95"
          >
            Clear
          </button>
        )}

        <p className="ml-auto text-xs text-white/40">
          {docsLoading ? "Loading…" : `${totalDocs} document${totalDocs !== 1 ? "s" : ""}`}
        </p>
      </div>

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm">
        {/* Table header */}
        <div className="hidden grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 border-b border-white/10 px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-white/40 lg:grid">
          <span>Title</span>
          <span>Category</span>
          <span>Expiry Date</span>
          <span>Status</span>
          <span>Ack Progress</span>
          <span></span>
        </div>

        {docsLoading ? (
          <div className="space-y-0">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="grid animate-pulse grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 border-b border-white/5 px-5 py-4"
              >
                <div className="h-3.5 w-3/4 rounded-full bg-white/10" />
                <div className="h-3 w-16 rounded-full bg-white/10" />
                <div className="h-3 w-20 rounded-full bg-white/10" />
                <div className="h-5 w-20 rounded-full bg-white/10" />
                <div className="h-3 w-28 rounded-full bg-white/10" />
                <div className="h-6 w-16 rounded-lg bg-white/10" />
              </div>
            ))}
          </div>
        ) : docsError ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <XCircle className="h-10 w-10 text-red-400 mb-3" />
            <p className="text-sm font-semibold text-white/70">{docsError}</p>
            <p className="mt-1 text-xs text-white/30">Make sure the Vault server is running on port 4001</p>
            <button
              onClick={fetchDocs}
              className="mt-4 flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white/80 transition-all hover:bg-white/15 active:scale-95"
            >
              <RefreshCw className="h-4 w-4" /> Retry
            </button>
          </div>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <ShieldCheck className="h-12 w-12 text-violet-400 mb-3" />
            <p className="text-sm font-semibold text-white/70">No documents found</p>
            <p className="mt-1 text-xs text-white/30">Try adjusting your filters</p>
          </div>
        ) : (
          <div>
            {docs.map((doc, i) => {
              const days = daysUntil(doc.expiresAt);
              const isExpiredRow = doc.status === "EXPIRED" || (days !== null && days < 0);
              const isCriticalRow = !isExpiredRow && doc.warningLevel === "high";
              const isWarnRow = !isExpiredRow && !isCriticalRow && (doc.warningLevel === "low" || doc.warningLevel === "medium");

              return (
                <div
                  key={doc.id}
                  className={`grid grid-cols-1 gap-2 border-b border-white/5 px-5 py-4 transition-colors last:border-0 hover:bg-white/5 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] lg:items-center lg:gap-4
                    ${isExpiredRow  ? "bg-red-900/10"    : ""}
                    ${isCriticalRow ? "bg-orange-900/10" : ""}
                    ${isWarnRow     ? "bg-yellow-900/5"  : ""}
                  `}
                >
                  {/* Title */}
                  <div className="flex items-start gap-2.5">
                    <div
                      className="mt-0.5 shrink-0 flex h-8 w-8 items-center justify-center rounded-lg"
                      style={{ background: "linear-gradient(135deg, #7c3aed40 0%, #5c64f640 100%)" }}
                    >
                      <FileText className="h-4 w-4 text-violet-300" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white/90">{doc.title}</p>
                      {doc.description && (
                        <p className="mt-0.5 truncate text-[11px] text-white/40">{doc.description}</p>
                      )}
                    </div>
                  </div>

                  {/* Category */}
                  <div className="lg:block">
                    <span className="inline-block rounded-lg bg-white/8 px-2 py-0.5 text-[11px] font-semibold text-white/60">
                      {CATEGORY_LABELS[doc.category] ?? doc.category}
                    </span>
                  </div>

                  {/* Expiry Date */}
                  <div>
                    <p className={`text-sm font-medium ${isExpiredRow ? "text-red-300" : isCriticalRow ? "text-orange-300" : isWarnRow ? "text-yellow-300" : "text-white/60"}`}>
                      {formatDate(doc.expiresAt)}
                    </p>
                    {days !== null && days >= 0 && days <= 30 && (
                      <p className="mt-0.5 text-[10px] text-white/30">{days}d left</p>
                    )}
                  </div>

                  {/* Status */}
                  <div>
                    <StatusChip doc={doc} />
                  </div>

                  {/* Ack Progress */}
                  <div>
                    <AckProgress documentId={doc.id} requiresAck={doc.requiresAck} />
                  </div>

                  {/* Action */}
                  <div>
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white/60 transition-all hover:border-violet-400/40 hover:bg-white/10 hover:text-violet-300 active:scale-95"
                    >
                      View <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="mt-5 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/60 backdrop-blur-sm transition-all hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-30 active:scale-95"
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = totalPages <= 5
                ? i + 1
                : Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`h-9 w-9 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                    p === page
                      ? "text-white shadow-lg shadow-violet-900/50"
                      : "border border-white/10 bg-white/5 text-white/50 hover:border-white/20 hover:text-white"
                  }`}
                  style={p === page ? { background: "linear-gradient(135deg, #7c3aed 0%, #5c64f6 100%)" } : {}}
                >
                  {p}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/60 backdrop-blur-sm transition-all hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-30 active:scale-95"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
