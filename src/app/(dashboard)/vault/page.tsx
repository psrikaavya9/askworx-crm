"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Upload, RefreshCw, AlertCircle, FileX2, Building2, FolderOpen } from "lucide-react";
import { VaultHeader }  from "@/components/vault/VaultHeader";
import { FilterBar }    from "@/components/vault/FilterBar";
import { DocumentCard } from "@/components/vault/DocumentCard";
import { UploadModal }  from "@/components/vault/UploadModal";
import { AlertWidget }  from "@/components/vault/AlertWidget";
import { listDocuments } from "@/lib/vault-api";
import { toast } from "@/components/ui/Toaster";
import type { HrDocument, DocumentCategory, DocumentStatus, WarningLevel } from "@/types/vault";

const PAGE_SIZE = 12;

// ---------------------------------------------------------------------------
// Skeleton card
// ---------------------------------------------------------------------------
function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-gray-100" />
        <div className="flex-1 space-y-2">
          <div className="h-2.5 w-16 rounded-full bg-gray-100" />
          <div className="h-2.5 w-24 rounded-full bg-gray-100" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-4 w-3/4 rounded-full bg-gray-100" />
        <div className="h-3 w-1/2 rounded-full bg-gray-100" />
      </div>
      <div className="mt-4 h-7 rounded-xl bg-gray-50" />
      <div className="mt-3 flex gap-2">
        <div className="h-8 flex-1 rounded-xl bg-gray-50" />
        <div className="h-8 flex-1 rounded-xl bg-gray-50" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function VaultPage() {
  const [docs, setDocs]           = useState<HrDocument[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [page, setPage]           = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalDocs, setTotalDocs] = useState(0);

  const [scope,        setScope]        = useState<"company" | "mine">("company");
  const [search,       setSearch]       = useState("");
  const [category,     setCategory]     = useState<DocumentCategory | "">("");
  const [status,       setStatus]       = useState<DocumentStatus | "">("");
  const [warningLevel, setWarningLevel] = useState<WarningLevel | "">("");

  const criticalToastShown = useRef(false);

  const [stats, setStats] = useState({ total: 0, active: 0, expired: 0, pendingAck: 0 });
  const [statsLoading, setStatsLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  // In a real app this comes from the auth context
  const isAdmin = true;

  // ---------- fetch stats (unfiltered) ----------
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const [totalRes, activeRes, expiredRes] = await Promise.all([
        listDocuments({ limit: 1 }),
        listDocuments({ status: "ACTIVE",  limit: 1 }),
        listDocuments({ status: "EXPIRED", limit: 1 }),
      ]);
      setStats({
        total:      totalRes.meta.total,
        active:     activeRes.meta.total,
        expired:    expiredRes.meta.total,
        pendingAck: 0,
      });
    } catch {
      // fail silently — stats are cosmetic
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // ---------- critical document toast (once per session) ----------
  useEffect(() => {
    if (!isAdmin || criticalToastShown.current) return;
    // Dynamic import to avoid circular dependency
    import("@/lib/vault-api").then(({ getDocumentAlerts }) => {
      getDocumentAlerts()
        .then((res) => {
          const n = res.data.counts.critical;
          if (n > 0 && !criticalToastShown.current) {
            criticalToastShown.current = true;
            toast.error(
              `${n} Critical Document${n !== 1 ? "s" : ""} Expiring`,
              `${n} document${n !== 1 ? "s are" : " is"} expiring within 7 days. Review now.`
            );
          }
        })
        .catch(() => {/* vault offline */});
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  // ---------- fetch documents (filtered) ----------
  const fetchDocs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listDocuments({
        search:       search       || undefined,
        category:     category     || undefined,
        status:       status       || undefined,
        warningLevel: warningLevel || undefined,
        page,
        limit: PAGE_SIZE,
      });
      setDocs(res.data);
      setTotalPages(res.meta.totalPages);
      setTotalDocs(res.meta.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [search, category, status, warningLevel, page]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [search, category, status, warningLevel]);

  function clearFilters() {
    setSearch("");
    setCategory("");
    setStatus("");
    setWarningLevel("");
    setPage(1);
    // Scope (tab) is intentionally NOT reset by clear — user stays on their chosen tab
  }

  const hasFilters = !!(search || category || status || warningLevel);

  // Client-side tab filtering
  // "company" → only shared docs (no employeeId)
  // "mine"    → all docs the user is authorized to see (personal + shared)
  const displayedDocs = scope === "company"
    ? docs.filter((d) => !d.employeeId)
    : docs;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <VaultHeader
        stats={statsLoading ? { total: 0, active: 0, expired: 0, pendingAck: 0 } : stats}
        isAdmin={isAdmin}
        onUploadClick={() => setShowUpload(true)}
      />

      {/* ── Alert Widget (admin only) ── */}
      {isAdmin && (
        <AlertWidget
          onFilterCritical={() => {
            setWarningLevel("high");
            setStatus("ACTIVE");
            setPage(1);
            if (!criticalToastShown.current) {
              criticalToastShown.current = true;
            }
          }}
          onFilterExpiringSoon={() => {
            setWarningLevel("low");
            setStatus("ACTIVE");
            setPage(1);
          }}
          onFilterExpired={() => {
            setStatus("EXPIRED");
            setWarningLevel("");
            setPage(1);
          }}
        />
      )}

      {/* ── Document scope tabs ── */}
      <div className="flex items-center gap-1 rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-gray-100">
        {(
          [
            { value: "company", label: "Company Documents", Icon: Building2 },
            { value: "mine",    label: "My Documents",      Icon: FolderOpen },
          ] as { value: "company" | "mine"; label: string; Icon: React.ElementType }[]
        ).map(({ value, label, Icon }) => (
          <button
            key={value}
            onClick={() => setScope(value)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
              scope === value
                ? "text-white shadow-md shadow-purple-200"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
            style={scope === value ? { background: "linear-gradient(135deg, #d25cf6 0%, #5c64f6 100%)" } : {}}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Filter Bar ── */}
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
        <FilterBar
          search={search}
          category={category}
          status={status}
          warningLevel={warningLevel}
          onSearch={setSearch}
          onCategory={setCategory}
          onStatus={setStatus}
          onWarningLevel={setWarningLevel}
          onClear={clearFilters}
          total={loading ? undefined : totalDocs}
        />
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>

      ) : error ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-red-100 bg-red-50/70 px-6 py-16 text-center shadow-sm">
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

      ) : displayedDocs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white px-6 py-20 text-center shadow-sm">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-3xl shadow-xl shadow-purple-200/60"
            style={{ background: "linear-gradient(135deg, #d25cf6 0%, #5c64f6 100%)" }}
          >
            <FileX2 className="h-10 w-10 text-white" />
          </div>
          <h3 className="mt-5 text-lg font-extrabold text-gray-900">No Documents Found</h3>
          <p className="mt-1.5 max-w-sm text-sm text-gray-500">
            {hasFilters
              ? "No documents match your current filters. Try adjusting or clearing them."
              : scope === "mine"
                ? "You have no documents assigned to you yet."
                : "No company-wide documents found. Get started by uploading your first HR document."}
          </p>
          {isAdmin && !hasFilters ? (
            <button
              onClick={() => setShowUpload(true)}
              className="mt-6 flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-purple-200 transition-all hover:-translate-y-0.5 hover:brightness-110 hover:shadow-xl active:scale-95"
              style={{ background: "linear-gradient(135deg, #d25cf6 0%, #5c64f6 100%)" }}
            >
              <Upload className="h-4 w-4" /> Upload First Document
            </button>
          ) : hasFilters ? (
            <button
              onClick={clearFilters}
              className="mt-6 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition-all hover:border-purple-300 hover:text-purple-700 active:scale-95"
            >
              Clear Filters
            </button>
          ) : null}
        </div>

      ) : (
        <>
          {/* Document grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {displayedDocs.map((doc) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                isAdmin={isAdmin}
                showAckButton={!isAdmin}
                onAcknowledged={fetchDocs}
                onArchived={() => { fetchDocs(); fetchStats(); }}
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

      {/* Upload Modal */}
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onUploaded={() => { fetchDocs(); fetchStats(); }}
        />
      )}
    </div>
  );
}
