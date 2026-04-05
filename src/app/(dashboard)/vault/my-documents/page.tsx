"use client";

import { useState, useEffect, useCallback } from "react";
import {
  User, RefreshCw, AlertCircle, FileX2, Bell,
  CheckCircle2, Clock, ShieldCheck,
} from "lucide-react";
import { DocumentCard } from "@/components/vault/DocumentCard";
import { FilterBar }    from "@/components/vault/FilterBar";
import { listDocuments } from "@/lib/vault-api";
import type { HrDocument, DocumentCategory, DocumentStatus } from "@/types/vault";

// ---------------------------------------------------------------------------
// Mini stat pill
// ---------------------------------------------------------------------------
function StatPill({
  icon, label, value, className,
}: {
  icon: React.ReactNode; label: string; value: number; className: string;
}) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl border bg-white/80 px-5 py-4 shadow-sm backdrop-blur-sm ${className}`}>
      <div className="shrink-0">{icon}</div>
      <div>
        <p className="text-2xl font-extrabold leading-none text-gray-900">{value}</p>
        <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------
function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-gray-100" />
        <div className="flex-1 space-y-2">
          <div className="h-2.5 w-16 rounded-full bg-gray-100" />
          <div className="h-2.5 w-20 rounded-full bg-gray-100" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-4 w-3/4 rounded-full bg-gray-100" />
        <div className="h-3 w-1/2 rounded-full bg-gray-100" />
      </div>
      <div className="mt-4 h-8 rounded-xl bg-gray-50" />
      <div className="mt-2 flex gap-2">
        <div className="h-8 flex-1 rounded-xl bg-gray-50" />
        <div className="h-8 flex-1 rounded-xl bg-gray-50" />
        <div className="h-8 flex-1 rounded-xl bg-gray-50" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function MyDocumentsPage() {
  const [allDocs, setAllDocs]       = useState<HrDocument[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalDocs, setTotalDocs]   = useState(0);

  const [search,   setSearch]   = useState("");
  const [category, setCategory] = useState<DocumentCategory | "">("");
  const [status,   setStatus]   = useState<DocumentStatus | "">("");

  // ---------------------------------------------------------------------------
  const fetchDocs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listDocuments({
        search:   search   || undefined,
        category: category || undefined,
        status:   status   || undefined,
        page,
        limit: 9,
      });
      setAllDocs(res.data);
      setTotalPages(res.meta.totalPages);
      setTotalDocs(res.meta.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [search, category, status, page]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);
  useEffect(() => { setPage(1); }, [search, category, status]);

  function clearFilters() {
    setSearch(""); setCategory(""); setStatus(""); setPage(1);
  }

  // Derived: pending ack docs (from current page)
  const pendingAck = allDocs.filter(
    (d) => d.requiresAck && !d.acknowledged && d.status === "ACTIVE"
  );
  const acknowledged = allDocs.filter((d) => d.acknowledged).length;
  const active       = allDocs.filter((d) => d.status === "ACTIVE").length;

  return (
    <div className="space-y-6">
      {/* ── Hero header ── */}
      <div className="relative overflow-hidden rounded-2xl border border-white/30 shadow-xl shadow-purple-900/20">
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(135deg, #d25cf6 0%, #5c64f6 100%)" }}
        />
        <div className="pointer-events-none absolute -right-10 -top-10 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />

        <div className="relative px-8 py-7">
          {/* Identity */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 ring-2 ring-white/30 shadow-lg">
              <User className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-white">My Documents</h1>
              <p className="mt-0.5 text-sm text-white/70">
                Documents assigned or visible to you
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatPill
              icon={<Bell className="h-4 w-4 text-orange-500" />}
              label="Pending Ack"
              value={loading ? 0 : pendingAck.length}
              className="border-orange-100"
            />
            <StatPill
              icon={<CheckCircle2 className="h-4 w-4 text-blue-500" />}
              label="Acknowledged"
              value={loading ? 0 : acknowledged}
              className="border-blue-100"
            />
            <StatPill
              icon={<ShieldCheck className="h-4 w-4 text-green-500" />}
              label="Active Docs"
              value={loading ? 0 : active}
              className="border-green-100"
            />
            <StatPill
              icon={<Clock className="h-4 w-4 text-purple-500" />}
              label="Total Visible"
              value={loading ? 0 : totalDocs}
              className="border-purple-100"
            />
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      </div>

      {/* ── Pending Acknowledgements alert ── */}
      {!loading && pendingAck.length > 0 && (
        <div className="flex items-center gap-4 rounded-2xl border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 px-5 py-4 shadow-sm">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100">
            <Bell className="h-5 w-5 text-orange-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-orange-800">
              {pendingAck.length} document{pendingAck.length > 1 ? "s" : ""} awaiting your acknowledgement
            </p>
            <p className="mt-0.5 text-xs text-orange-600">
              Please review and acknowledge these documents at your earliest convenience.
            </p>
          </div>
          <button
            onClick={() => setStatus("ACTIVE")}
            className="shrink-0 rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-orange-200 transition-all hover:bg-orange-700 hover:-translate-y-0.5 active:scale-95"
          >
            Review
          </button>
        </div>
      )}

      {/* ── Filter Bar ── */}
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
        <FilterBar
          search={search}
          category={category}
          status={status}
          warningLevel=""
          onSearch={setSearch}
          onCategory={setCategory}
          onStatus={setStatus}
          onWarningLevel={() => {}}
          onClear={clearFilters}
          total={loading ? undefined : totalDocs}
        />
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>

      ) : error ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-red-100 bg-red-50/70 px-6 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 shadow-md shadow-red-100">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h3 className="mt-4 text-base font-bold text-gray-900">Failed to Load Documents</h3>
          <p className="mt-1.5 max-w-sm text-sm text-gray-500">{error}</p>
          <p className="mt-1 text-xs text-gray-400">Make sure the Vault server is running on port 4001</p>
          <button
            onClick={fetchDocs}
            className="mt-5 flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-gray-200 transition-all hover:ring-purple-300 hover:text-purple-700 active:scale-95"
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        </div>

      ) : allDocs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white px-6 py-20 text-center shadow-sm">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-3xl shadow-xl shadow-purple-200/60"
            style={{ background: "linear-gradient(135deg, #d25cf6 0%, #5c64f6 100%)" }}
          >
            <FileX2 className="h-10 w-10 text-white" />
          </div>
          <h3 className="mt-5 text-lg font-extrabold text-gray-900">No Documents Found</h3>
          <p className="mt-1.5 max-w-sm text-sm text-gray-500">
            {search || category || status
              ? "Try adjusting or clearing your filters."
              : "No documents have been assigned to you yet."}
          </p>
          {(search || category || status) && (
            <button
              onClick={clearFilters}
              className="mt-5 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition-all hover:border-purple-300 hover:text-purple-700 active:scale-95"
            >
              Clear Filters
            </button>
          )}
        </div>

      ) : (
        <>
          {/* Document grid — employee view (ack button shown) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {allDocs.map((doc) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                isAdmin={false}
                showAckButton={true}
                onAcknowledged={fetchDocs}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:border-purple-300 hover:text-purple-700 disabled:cursor-not-allowed disabled:opacity-40 active:scale-95"
              >
                ← Prev
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const p = totalPages <= 5 ? i + 1 : Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`h-9 w-9 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                        p === page
                          ? "text-white shadow-md shadow-purple-200"
                          : "border border-gray-200 bg-white text-gray-600 hover:border-purple-300 hover:text-purple-700"
                      }`}
                      style={p === page ? { background: "linear-gradient(135deg, #d25cf6 0%, #5c64f6 100%)" } : {}}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:border-purple-300 hover:text-purple-700 disabled:cursor-not-allowed disabled:opacity-40 active:scale-95"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
