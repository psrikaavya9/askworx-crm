"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Phone, MapPin, StickyNote,
  CheckCircle2, XCircle, PencilLine, Clock,
  ChevronDown, X, Loader2, AlertTriangle,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { useApiClient } from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type InteractionType = "CALL" | "VISIT" | "NOTE";
type ReviewStatus    = "PENDING" | "EDIT_REQUESTED" | "REJECTED";
type ToastVariant    = "success" | "error" | "info";

export interface ReviewRow {
  id:        string;
  type:      InteractionType;
  date:      string;
  duration:  number | null;
  outcome:   string | null;
  notes:     string | null;
  approved:  boolean;
  rejected:  boolean;
  ownerNote: string | null;
  client: { id: string; firstName: string; lastName: string; company: string } | null;
  staff:  { firstName: string; lastName: string; department: string | null } | null;
}

interface Toast {
  id:      string;
  variant: ToastVariant;
  message: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deriveStatus(row: ReviewRow): ReviewStatus {
  if (row.rejected) return "REJECTED";
  if (row.ownerNote) return "EDIT_REQUESTED";
  return "PENDING";
}

function uid() {
  return Math.random().toString(36).slice(2);
}

// ---------------------------------------------------------------------------
// Toast system
// ---------------------------------------------------------------------------

const TOAST_ICONS: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle2  className="h-4 w-4 text-emerald-500 shrink-0" />,
  error:   <AlertTriangle className="h-4 w-4 text-red-500     shrink-0" />,
  info:    <Clock         className="h-4 w-4 text-blue-500    shrink-0" />,
};

const TOAST_STYLES: Record<ToastVariant, string> = {
  success: "border-emerald-200 bg-emerald-50",
  error:   "border-red-200   bg-red-50",
  info:    "border-blue-200  bg-blue-50",
};

const TOAST_TEXT: Record<ToastVariant, string> = {
  success: "text-emerald-800",
  error:   "text-red-800",
  info:    "text-blue-800",
};

function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2.5 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto flex min-w-[280px] max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-lg",
            "animate-in slide-in-from-right-4 fade-in duration-200",
            TOAST_STYLES[t.variant],
          )}
        >
          {TOAST_ICONS[t.variant]}
          <p className={cn("flex-1 text-sm font-medium", TOAST_TEXT[t.variant])}>{t.message}</p>
          <button
            onClick={() => onDismiss(t.id)}
            className="ml-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, variant: ToastVariant = "success") => {
    const id = uid();
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, push, dismiss };
}

// ---------------------------------------------------------------------------
// Modal — shared by Reject and Request Edit
// ---------------------------------------------------------------------------

interface ModalProps {
  title:        string;
  description:  string;
  placeholder:  string;
  confirmLabel: string;
  confirmClass: string;
  icon:         React.ReactNode;
  loading:      boolean;
  onConfirm:    (text: string) => void;
  onClose:      () => void;
}

function Modal({
  title, description, placeholder, confirmLabel, confirmClass,
  icon, loading, onConfirm, onClose,
}: ModalProps) {
  const [text, setText]     = useState("");
  const textareaRef          = useRef<HTMLTextAreaElement>(null);
  const MAX                  = 500;

  // Focus textarea on mount
  useEffect(() => { textareaRef.current?.focus(); }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-50">
              {icon}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
              <p className="mt-0.5 text-xs text-gray-400">{description}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <textarea
            ref={textareaRef}
            rows={4}
            maxLength={MAX}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
          />
          <div className="mt-1.5 flex justify-between">
            <p className="text-[11px] text-gray-400">Press Esc to cancel</p>
            <p className={cn("text-[11px]", text.length >= MAX * 0.9 ? "text-amber-500" : "text-gray-400")}>
              {text.length}/{MAX}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-4">
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => text.trim() && onConfirm(text.trim())}
            disabled={loading || !text.trim()}
            className={cn(
              "flex min-w-[90px] items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50",
              confirmClass,
            )}
          >
            {loading ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

const TYPE_ICON: Record<InteractionType, React.ReactNode> = {
  CALL:  <Phone      className="h-3.5 w-3.5" />,
  VISIT: <MapPin     className="h-3.5 w-3.5" />,
  NOTE:  <StickyNote className="h-3.5 w-3.5" />,
};

const TYPE_COLOR: Record<InteractionType, string> = {
  CALL:  "bg-blue-50    text-blue-700",
  VISIT: "bg-emerald-50 text-emerald-700",
  NOTE:  "bg-amber-50   text-amber-700",
};

const STATUS_CONFIG: Record<ReviewStatus, { label: string; cls: string; icon: React.ReactNode }> = {
  PENDING:        { label: "Pending",        cls: "bg-gray-100    text-gray-600",    icon: <Clock      className="h-3 w-3" /> },
  EDIT_REQUESTED: { label: "Edit Requested", cls: "bg-orange-100  text-orange-700",  icon: <PencilLine className="h-3 w-3" /> },
  REJECTED:       { label: "Rejected",       cls: "bg-red-100     text-red-700",     icon: <XCircle    className="h-3 w-3" /> },
};

// ---------------------------------------------------------------------------
// Expandable note cell
// ---------------------------------------------------------------------------

function NoteCell({ text }: { text: string | null }) {
  const [open, setOpen] = useState(false);
  if (!text) return <span className="text-gray-300">—</span>;
  const long = text.length > 60;
  return (
    <div className="max-w-[200px]">
      <p className={cn("text-xs leading-relaxed text-gray-600", !open && "line-clamp-2")}>{text}</p>
      {long && (
        <button
          onClick={() => setOpen((v) => !v)}
          className="mt-0.5 flex items-center gap-0.5 text-[10px] font-medium text-indigo-500 hover:text-indigo-700"
        >
          {open ? "Less" : "More"}
          <ChevronDown className={cn("h-2.5 w-2.5 transition-transform", open && "rotate-180")} />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-row action buttons
// ---------------------------------------------------------------------------

interface ActionCellProps {
  row:           ReviewRow;
  busyId:        string | null;   // which row ID is currently processing
  onApprove:     (id: string) => void;
  onReject:      (id: string) => void;
  onRequestEdit: (id: string) => void;
}

function ActionCell({ row, busyId, onApprove, onReject, onRequestEdit }: ActionCellProps) {
  const busy = busyId === row.id;

  return (
    <div className="flex items-center justify-end gap-1.5">
      {/* Approve */}
      <button
        onClick={() => onApprove(row.id)}
        disabled={!!busyId}
        title="Approve"
        className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
        Approve
      </button>

      {/* Request Edit */}
      <button
        onClick={() => onRequestEdit(row.id)}
        disabled={!!busyId}
        title="Request Edit"
        className="flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <PencilLine className="h-3.5 w-3.5" />
        Edit
      </button>

      {/* Reject */}
      <button
        onClick={() => onReject(row.id)}
        disabled={!!busyId}
        title="Reject"
        className="flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <XCircle className="h-3.5 w-3.5" />
        Reject
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter bar
// ---------------------------------------------------------------------------

type StatusFilter = "ALL" | "PENDING" | "EDIT_REQUESTED";
type TypeFilter   = "ALL" | InteractionType;

interface FilterBarProps {
  status:   StatusFilter;
  type:     TypeFilter;
  onStatus: (s: StatusFilter) => void;
  onType:   (t: TypeFilter) => void;
  counts:   { all: number; pending: number; editRequested: number };
}

function FilterBar({ status, type, onStatus, onType, counts }: FilterBarProps) {
  const tabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: "ALL",            label: "All",           count: counts.all },
    { key: "PENDING",        label: "Pending",        count: counts.pending },
    { key: "EDIT_REQUESTED", label: "Edit Requested", count: counts.editRequested },
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {/* Status tabs */}
      <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onStatus(tab.key)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              status === tab.key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-900",
            )}
          >
            {tab.label}
            <span className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
              status === tab.key ? "bg-indigo-100 text-indigo-700" : "bg-gray-200 text-gray-500",
            )}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Type pills */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-gray-400">Type:</span>
        {(["ALL", "CALL", "VISIT", "NOTE"] as TypeFilter[]).map((t) => (
          <button
            key={t}
            onClick={() => onType(t)}
            className={cn(
              "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
              type === t ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200",
            )}
          >
            {t === "ALL" ? "All" : t.charAt(0) + t.slice(1).toLowerCase()}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main dashboard
// ---------------------------------------------------------------------------

type ModalState =
  | { kind: "reject";       id: string }
  | { kind: "request-edit"; id: string }
  | null;

export function ReviewsDashboard({
  initialRows,
  initialTotal,
}: {
  initialRows:  ReviewRow[];
  initialTotal: number;
}) {
  const { patch }           = useApiClient();
  const router              = useRouter();
  const { toasts, push, dismiss } = useToast();

  const [rows,         setRows]         = useState<ReviewRow[]>(initialRows);
  const [total,        setTotal]        = useState(initialTotal);
  const [modal,        setModal]        = useState<ModalState>(null);
  const [busyId,       setBusyId]       = useState<string | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [typeFilter,   setTypeFilter]   = useState<TypeFilter>("ALL");

  // Derived counts
  const pendingCount       = rows.filter((r) => !r.rejected && !r.ownerNote).length;
  const editRequestedCount = rows.filter((r) => !r.rejected && !!r.ownerNote).length;

  // Client-side filtered view
  const visible = rows.filter((r) => {
    const s = deriveStatus(r);
    const passStatus =
      statusFilter === "ALL" ||
      (statusFilter === "PENDING"        && s === "PENDING") ||
      (statusFilter === "EDIT_REQUESTED" && s === "EDIT_REQUESTED");
    return passStatus && (typeFilter === "ALL" || r.type === typeFilter);
  });

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  async function approve(id: string) {
    setBusyId(id);
    try {
      await patch(`/api/interactions/${id}/approve`);
      setRows((prev) => prev.filter((r) => r.id !== id));
      setTotal((t) => t - 1);
      push("Interaction approved successfully", "success");
      router.refresh();
    } catch {
      push("Approve failed — please try again", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string, reason: string) {
    setModalLoading(true);
    try {
      await patch(`/api/interactions/${id}/reject`, { reason });
      setRows((prev) => prev.filter((r) => r.id !== id));
      setTotal((t) => t - 1);
      setModal(null);
      push("Interaction rejected", "info");
      router.refresh();
    } catch {
      push("Reject failed — please try again", "error");
    } finally {
      setModalLoading(false);
    }
  }

  async function requestEdit(id: string, instructions: string) {
    setModalLoading(true);
    try {
      await patch(`/api/interactions/${id}/edit-request`, { message: instructions });
      setRows((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, ownerNote: instructions, rejected: false } : r,
        ),
      );
      setModal(null);
      push("Edit request sent to staff member", "info");
    } catch {
      push("Request edit failed — please try again", "error");
    } finally {
      setModalLoading(false);
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <>
      {/* Toast stack */}
      <ToastStack toasts={toasts} onDismiss={dismiss} />

      {/* Reject modal */}
      {modal?.kind === "reject" && (
        <Modal
          title="Reject Interaction"
          description="Staff will not be notified automatically. Add a clear reason."
          placeholder="Explain why this interaction is being rejected…"
          confirmLabel="Reject"
          confirmClass="bg-red-600 hover:bg-red-700"
          icon={<XCircle className="h-5 w-5 text-red-500" />}
          loading={modalLoading}
          onConfirm={(r) => reject(modal.id, r)}
          onClose={() => setModal(null)}
        />
      )}

      {/* Request-edit modal */}
      {modal?.kind === "request-edit" && (
        <Modal
          title="Request Edit"
          description="Describe exactly what needs to be corrected or added."
          placeholder="e.g. GPS location is missing, please log the visit again with location enabled…"
          confirmLabel="Send Back"
          confirmClass="bg-amber-500 hover:bg-amber-600"
          icon={<PencilLine className="h-5 w-5 text-amber-500" />}
          loading={modalLoading}
          onConfirm={(r) => requestEdit(modal.id, r)}
          onClose={() => setModal(null)}
        />
      )}

      <div className="space-y-5">
        {/* Filter bar */}
        <FilterBar
          status={statusFilter}
          type={typeFilter}
          onStatus={setStatusFilter}
          onType={setTypeFilter}
          counts={{ all: rows.length, pending: pendingCount, editRequested: editRequestedCount }}
        />

        {/* Empty state */}
        {visible.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-gray-200 bg-white py-20 text-center shadow-sm">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
              <CheckCircle2 className="h-7 w-7 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">All caught up</p>
              <p className="mt-1 text-xs text-gray-400">
                {statusFilter === "ALL"
                  ? "No interactions pending review."
                  : `No ${statusFilter.replace(/_/g, " ").toLowerCase()} interactions.`}
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  {[
                    { label: "Type",       cls: "" },
                    { label: "Client",     cls: "" },
                    { label: "Staff",      cls: "" },
                    { label: "Date",       cls: "whitespace-nowrap" },
                    { label: "Outcome",    cls: "" },
                    { label: "Notes",      cls: "" },
                    { label: "Status",     cls: "" },
                    { label: "Owner Note", cls: "" },
                    { label: "Actions",    cls: "text-right" },
                  ].map((h) => (
                    <th
                      key={h.label}
                      className={cn(
                        "px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400",
                        h.cls,
                      )}
                    >
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-50">
                {visible.map((row) => {
                  const status = deriveStatus(row);
                  const scfg   = STATUS_CONFIG[status];
                  const isRejected = status === "REJECTED";

                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        "transition-colors hover:bg-gray-50/60",
                        isRejected && "opacity-50",
                        busyId === row.id && "bg-indigo-50/30",
                      )}
                    >
                      {/* Type badge */}
                      <td className="px-4 py-3.5">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                          TYPE_COLOR[row.type],
                        )}>
                          {TYPE_ICON[row.type]}
                          {row.type.charAt(0) + row.type.slice(1).toLowerCase()}
                        </span>
                      </td>

                      {/* Client */}
                      <td className="px-4 py-3.5">
                        {row.client ? (
                          <div>
                            <p className="text-xs font-semibold text-gray-800 leading-snug">
                              {row.client.firstName} {row.client.lastName}
                            </p>
                            <p className="text-[11px] text-gray-400">{row.client.company}</p>
                          </div>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>

                      {/* Staff */}
                      <td className="px-4 py-3.5">
                        {row.staff ? (
                          <div>
                            <p className="text-xs font-medium text-gray-700 leading-snug">
                              {row.staff.firstName} {row.staff.lastName}
                            </p>
                            {row.staff.department && (
                              <p className="text-[11px] text-gray-400">{row.staff.department}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <p className="text-xs text-gray-600">{formatDate(row.date)}</p>
                        {row.duration != null && (
                          <p className="text-[11px] text-gray-400">{row.duration} min</p>
                        )}
                      </td>

                      {/* Outcome */}
                      <td className="px-4 py-3.5">
                        <p className="max-w-[160px] truncate text-xs text-gray-600" title={row.outcome ?? ""}>
                          {row.outcome ?? <span className="text-gray-300">—</span>}
                        </p>
                      </td>

                      {/* Notes */}
                      <td className="px-4 py-3.5">
                        <NoteCell text={row.notes} />
                      </td>

                      {/* Status badge */}
                      <td className="px-4 py-3.5">
                        <span className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                          scfg.cls,
                        )}>
                          {scfg.icon}
                          {scfg.label}
                        </span>
                      </td>

                      {/* Owner note */}
                      <td className="px-4 py-3.5">
                        <NoteCell text={row.ownerNote} />
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5">
                        {!isRejected ? (
                          <ActionCell
                            row={row}
                            busyId={busyId}
                            onApprove={approve}
                            onReject={(id) => setModal({ kind: "reject", id })}
                            onRequestEdit={(id) => setModal({ kind: "request-edit", id })}
                          />
                        ) : (
                          <span className="block text-right text-xs text-gray-300">Closed</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/60 px-4 py-3">
              <p className="text-xs text-gray-400">
                Showing{" "}
                <span className="font-semibold text-gray-700">{visible.length}</span> of{" "}
                <span className="font-semibold text-gray-700">{total}</span> unresolved
                {total !== 1 ? " interactions" : " interaction"}
              </p>
              {rows.length !== visible.length && (
                <button
                  onClick={() => { setStatusFilter("ALL"); setTypeFilter("ALL"); }}
                  className="text-xs font-medium text-indigo-500 hover:text-indigo-700 transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
