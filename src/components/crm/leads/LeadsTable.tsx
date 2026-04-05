"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Plus, Search, Filter, MoreHorizontal,
  ChevronUp, ChevronDown, Snowflake,
  UserCheck, ArrowRightCircle, Trash2, X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { StageBadge } from "@/components/crm/shared/StageBadge";
import { PriorityBadge } from "@/components/crm/shared/PriorityBadge";
import { ScoreBadge } from "@/components/crm/shared/ScoreBadge";
import { CreateLeadModal } from "./CreateLeadModal";
import { BulkAssignModal } from "./BulkAssignModal";
import { BulkMoveStageModal } from "./BulkMoveStageModal";
import { formatCurrency, formatDate, getInitials } from "@/lib/utils";
import type { Lead, LeadScore } from "@/modules/crm/types";
import type { PaginatedResult } from "@/modules/crm/types";

const STAGE_OPTIONS  = ["", "NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"];
const SOURCE_OPTIONS = ["", "WEBSITE", "REFERRAL", "SOCIAL_MEDIA", "EMAIL_CAMPAIGN", "COLD_CALL", "TRADE_SHOW", "PARTNER", "OTHER"];
const SCORE_OPTIONS  = ["", "HOT", "WARM", "COLD"];

const STAGE_LABELS:  Record<string, string> = { "": "All Stages",  NEW: "New", CONTACTED: "Contacted", QUALIFIED: "Qualified", PROPOSAL: "Proposal", WON: "Won", LOST: "Lost" };
const SOURCE_LABELS: Record<string, string> = { "": "All Sources", WEBSITE: "Website", REFERRAL: "Referral", SOCIAL_MEDIA: "Social Media", EMAIL_CAMPAIGN: "Email Campaign", COLD_CALL: "Cold Call", TRADE_SHOW: "Trade Show", PARTNER: "Partner", OTHER: "Other" };
const SCORE_LABELS:  Record<string, string> = { "": "All Scores",  HOT: "🔴 Hot", WARM: "🟡 Warm", COLD: "⚪ Cold" };

interface LeadsTableProps {
  data: PaginatedResult<Lead & { score?: LeadScore | null }>;
}

const AVATAR_COLORS = [
  "from-indigo-400 to-indigo-600",
  "from-violet-400 to-violet-600",
  "from-teal-400 to-teal-600",
  "from-blue-400 to-blue-600",
  "from-pink-400 to-pink-600",
];

function getAvatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

type BulkModal = "assign" | "stage" | null;

export function LeadsTable({ data }: LeadsTableProps) {
  const router      = useRouter();
  const pathname    = usePathname();
  const searchParams = useSearchParams();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [search, setSearch]                   = useState(searchParams.get("search") ?? "");

  // ── Bulk selection state ────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkModal,   setBulkModal]   = useState<BulkModal>(null);
  const [bulkToast,   setBulkToast]   = useState<string | null>(null);
  const [deleting,    setDeleting]    = useState(false);

  const pageIds          = data.data.map((l) => l.id);
  const allPageSelected  = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected = pageIds.some((id) => selectedIds.has(id));

  function toggleAll() {
    if (allPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => new Set([...prev, ...pageIds]));
    }
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  const showToast = useCallback((msg: string) => {
    setBulkToast(msg);
    setTimeout(() => setBulkToast(null), 3500);
  }, []);

  // ── Bulk delete ─────────────────────────────────────────────────────────
  async function handleBulkDelete() {
    const ids = [...selectedIds];
    if (!window.confirm(`Permanently delete ${ids.length} lead${ids.length !== 1 ? "s" : ""}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/crm/leads/bulk-delete", {
        method:  "DELETE",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ lead_ids: ids }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Delete failed");
      clearSelection();
      showToast(`Deleted ${json.deleted} lead${json.deleted !== 1 ? "s" : ""}`);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  // ── URL param helpers ───────────────────────────────────────────────────
  function updateParams(updates: Record<string, string | number>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === "" || v === undefined) params.delete(k);
      else params.set(k, String(v));
    }
    router.push(`${pathname}?${params.toString()}`);
    clearSelection(); // reset selection on filter/page change
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    updateParams({ search, page: 1 });
  }

  function handleSort(col: string) {
    const current = searchParams.get("sortBy");
    const order   = searchParams.get("sortOrder") ?? "desc";
    updateParams({
      sortBy:    col,
      sortOrder: current === col ? (order === "asc" ? "desc" : "asc") : "desc",
    });
  }

  const sortBy    = searchParams.get("sortBy")    ?? "createdAt";
  const sortOrder = searchParams.get("sortOrder") ?? "desc";

  function SortIcon({ col }: { col: string }) {
    if (sortBy !== col) return <ChevronDown className="h-3.5 w-3.5 text-gray-300" />;
    return sortOrder === "asc"
      ? <ChevronUp   className="h-3.5 w-3.5 text-indigo-500" />
      : <ChevronDown className="h-3.5 w-3.5 text-indigo-500" />;
  }

  const selCount = selectedIds.size;

  return (
    <div className="flex flex-col gap-4">

      {/* ── Toast notification ─────────────────────────────────────────── */}
      {bulkToast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-gray-900 px-5 py-3 text-sm font-medium text-white shadow-lg">
          {bulkToast}
        </div>
      )}

      {/* ── Bulk action toolbar (visible when items are selected) ────────── */}
      {selCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5">
          <span className="text-sm font-semibold text-indigo-700">
            {selCount} lead{selCount !== 1 ? "s" : ""} selected
          </span>
          <div className="ml-2 flex items-center gap-2">
            <Button
              size="sm"
              icon={<UserCheck className="h-3.5 w-3.5" />}
              onClick={() => setBulkModal("assign")}
            >
              Assign
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={<ArrowRightCircle className="h-3.5 w-3.5" />}
              onClick={() => setBulkModal("stage")}
            >
              Move Stage
            </Button>
            <Button
              size="sm"
              variant="danger"
              icon={<Trash2 className="h-3.5 w-3.5" />}
              onClick={handleBulkDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
          <button
            onClick={clearSelection}
            className="ml-auto rounded-lg p-1.5 text-indigo-400 hover:bg-indigo-100 hover:text-indigo-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Search / filter toolbar ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <form onSubmit={handleSearch} className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads…"
            className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-colors"
          />
        </form>

        <select
          value={searchParams.get("stage") ?? ""}
          onChange={(e) => updateParams({ stage: e.target.value, page: 1 })}
          className="rounded-lg border border-gray-300 bg-white py-2.5 pl-3 pr-8 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-colors"
        >
          {STAGE_OPTIONS.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
        </select>

        <select
          value={searchParams.get("source") ?? ""}
          onChange={(e) => updateParams({ source: e.target.value, page: 1 })}
          className="rounded-lg border border-gray-300 bg-white py-2.5 pl-3 pr-8 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-colors"
        >
          {SOURCE_OPTIONS.map((s) => <option key={s} value={s}>{SOURCE_LABELS[s]}</option>)}
        </select>

        <select
          value={searchParams.get("scoreCategory") ?? ""}
          onChange={(e) => updateParams({ scoreCategory: e.target.value, page: 1 })}
          className="rounded-lg border border-gray-300 bg-white py-2.5 pl-3 pr-8 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-colors"
        >
          {SCORE_OPTIONS.map((s) => <option key={s} value={s}>{SCORE_LABELS[s]}</option>)}
        </select>

        <div className="ml-auto">
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setShowCreateModal(true)}>
            Add Lead
          </Button>
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-md">
        {data.data.length === 0 ? (
          <EmptyState
            icon={<Filter className="h-6 w-6" />}
            title="No leads found"
            description="Try adjusting your filters or add your first lead."
            action={
              <Button icon={<Plus className="h-4 w-4" />} onClick={() => setShowCreateModal(true)}>
                Add Lead
              </Button>
            }
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {/* Select-all checkbox */}
                <th className="w-10 px-4 py-3.5">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = somePageSelected && !allPageSelected;
                    }}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </th>
                <th className="px-5 py-3.5 text-left">
                  <button onClick={() => handleSort("firstName")} className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-800">
                    Lead <SortIcon col="firstName" />
                  </button>
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Score</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Stage</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Priority</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Source</th>
                <th className="px-5 py-3.5 text-left">
                  <button onClick={() => handleSort("dealValue")} className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-800">
                    Deal Value <SortIcon col="dealValue" />
                  </button>
                </th>
                <th className="px-5 py-3.5 text-left">
                  <button onClick={() => handleSort("createdAt")} className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-800">
                    Created <SortIcon col="createdAt" />
                  </button>
                </th>
                <th className="px-5 py-3.5 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.data.map((lead) => {
                const initials    = getInitials(lead.firstName, lead.lastName);
                const avatarGrad  = getAvatarColor(lead.firstName);
                const isSelected  = selectedIds.has(lead.id);
                return (
                  <tr
                    key={lead.id}
                    className={`group transition-colors ${isSelected ? "bg-indigo-50" : "bg-white hover:bg-gray-50"}`}
                  >
                    {/* Row checkbox */}
                    <td className="w-10 px-4 py-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOne(lead.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-5 py-4">
                      <Link href={`/crm/leads/${lead.id}`} className="flex items-center gap-3">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${avatarGrad} text-xs font-bold text-white`}>
                          {initials}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                              {lead.firstName} {lead.lastName}
                            </p>
                            {lead.isCold && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">
                                <Snowflake className="h-2.5 w-2.5" />
                                Cold
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400">{lead.email}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-5 py-4">
                      {lead.score
                        ? <ScoreBadge category={lead.score.category} score={lead.score.totalScore} size="md" />
                        : <span className="text-xs text-gray-400">—</span>}
                    </td>
                    <td className="px-5 py-4"><StageBadge stage={lead.stage} /></td>
                    <td className="px-5 py-4"><PriorityBadge priority={lead.priority} /></td>
                    <td className="px-5 py-4 text-sm text-gray-500">{SOURCE_LABELS[lead.source] ?? lead.source}</td>
                    <td className="px-5 py-4 font-semibold text-gray-900">
                      {formatCurrency(lead.dealValue ? Number(lead.dealValue) : null)}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-400">{formatDate(lead.createdAt)}</td>
                    <td className="px-5 py-4">
                      <Link
                        href={`/crm/leads/${lead.id}`}
                        className="invisible rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 group-hover:visible transition-colors"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {data.totalPages > 1 && (
        <Pagination
          page={data.page}
          totalPages={data.totalPages}
          total={data.total}
          pageSize={data.pageSize}
          onPageChange={(p) => updateParams({ page: p })}
        />
      )}

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      <CreateLeadModal open={showCreateModal} onClose={() => setShowCreateModal(false)} />

      <BulkAssignModal
        open={bulkModal === "assign"}
        leadCount={selCount}
        leadIds={[...selectedIds]}
        onClose={() => setBulkModal(null)}
        onSuccess={(updated, skipped) => {
          clearSelection();
          showToast(
            skipped > 0
              ? `Assigned ${updated} lead${updated !== 1 ? "s" : ""} (${skipped} skipped — already assigned)`
              : `Assigned ${updated} lead${updated !== 1 ? "s" : ""}`,
          );
          router.refresh();
        }}
      />

      <BulkMoveStageModal
        open={bulkModal === "stage"}
        leadCount={selCount}
        leadIds={[...selectedIds]}
        onClose={() => setBulkModal(null)}
        onSuccess={(updated) => {
          clearSelection();
          showToast(`Moved ${updated} lead${updated !== 1 ? "s" : ""} to new stage`);
          router.refresh();
        }}
      />
    </div>
  );
}
