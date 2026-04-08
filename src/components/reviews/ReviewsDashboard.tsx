"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Phone, MapPin, StickyNote, Mail, MessageSquare,
  CheckCircle2, XCircle, PencilLine, Clock,
  ChevronDown, X, Loader2, AlertTriangle, Flame,
  CheckSquare, Square, Minus,
  CalendarDays, User, Users, Filter,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { useApiClient } from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type InteractionType = "CALL" | "VISIT" | "NOTE" | "EMAIL" | "WHATSAPP";
type ReviewStatus    = "PENDING" | "EDIT_REQUESTED" | "REJECTED";
type ToastVariant    = "success" | "error" | "info";

export interface ReviewRow {
  id:           string;
  type:         InteractionType;
  date:         string;
  createdAt:    string;
  staffId:      string;
  duration:     number | null;
  outcome:      string | null;
  notes:        string | null;
  approved:     boolean;
  rejected:     boolean;
  ownerNote:    string | null;
  reviewStatus: string;
  reviewReason: string | null;
  client: { id: string; firstName: string; lastName: string; company: string } | null;
  staff:  { id: string; firstName: string; lastName: string; department: string | null } | null;
}

interface Toast {
  id:      string;
  variant: ToastVariant;
  message: string;
}

// ---------------------------------------------------------------------------
// SLA helpers
// ---------------------------------------------------------------------------

interface SlaInfo {
  label:     string;
  tier:      "green" | "yellow" | "red";
  hours:     number;
  escalated: boolean;
}

function getSlaInfo(createdAt: string, reviewStatus: string): SlaInfo | null {
  if (reviewStatus !== "PENDING") return null;
  const ms    = Date.now() - new Date(createdAt).getTime();
  const hours = ms / (1000 * 60 * 60);
  const days  = Math.floor(hours / 24);
  const rem   = Math.floor(hours % 24);
  // Short label: "10h" | "2d 4h" | "3d ⚠"
  const label = days > 0
    ? hours >= 48 ? `${days}d ${rem}h ⚠` : `${days}d ${rem}h`
    : `${Math.floor(hours)}h`;

  let tier: SlaInfo["tier"];
  if (hours < 24)  tier = "green";
  else if (hours < 48) tier = "yellow";
  else tier = "red";

  return { label, tier, hours, escalated: hours >= 48 };
}

const SLA_BADGE_CLS: Record<SlaInfo["tier"], string> = {
  green:  "bg-green-50  border-green-200  text-green-700",
  yellow: "bg-yellow-50 border-yellow-200 text-yellow-700",
  red:    "bg-red-50    border-red-200    text-red-700",
};

function SlaBadge({ createdAt, reviewStatus }: { createdAt: string; reviewStatus: string }) {
  const sla = getSlaInfo(createdAt, reviewStatus);
  if (!sla) return <span className="text-gray-300 text-xs">—</span>;
  return (
    <div className="space-y-0.5">
      <span className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        SLA_BADGE_CLS[sla.tier],
      )}>
        <Clock className="h-2.5 w-2.5" />
        {sla.label}
      </span>
      {sla.escalated && (
        <p className="flex items-center gap-0.5 text-[10px] font-semibold text-red-600">
          <AlertTriangle className="h-2.5 w-2.5" />
          Escalated
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status derivation
// ---------------------------------------------------------------------------

function deriveStatus(row: ReviewRow): ReviewStatus {
  if (row.rejected) return "REJECTED";
  if (row.ownerNote) return "EDIT_REQUESTED";
  return "PENDING";
}

function uid() { return Math.random().toString(36).slice(2); }

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
          <button onClick={() => onDismiss(t.id)} className="ml-1 text-gray-400 hover:text-gray-600 transition-colors">
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
// Rejection modal — dropdown + optional note
// ---------------------------------------------------------------------------

const REJECTION_REASONS = ["Wrong Data", "Incomplete", "Policy Violation", "Other"] as const;
type RejectionReason = typeof REJECTION_REASONS[number];

interface RejectModalProps {
  loading:   boolean;
  onConfirm: (reason: RejectionReason, note: string) => void;
  onClose:   () => void;
}

function RejectModal({ loading, onConfirm, onClose }: RejectModalProps) {
  const [reason, setReason] = useState<RejectionReason | "">("");
  const [note,   setNote]   = useState("");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50">
              <XCircle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Reject Interaction</h3>
              <p className="mt-0.5 text-xs text-gray-400">Select a reason (required)</p>
            </div>
          </div>
          <button onClick={onClose} disabled={loading} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 transition-colors disabled:opacity-50">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          {/* Reason dropdown */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-700">
              Rejection Reason <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {REJECTION_REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-xs font-medium transition-colors text-left",
                    reason === r
                      ? "border-red-300 bg-red-50 text-red-700"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Optional note */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-700">
              Additional Note <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              rows={3}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add more context if needed…"
              className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
            />
            <p className={cn("mt-1 text-right text-[11px]", note.length >= 450 ? "text-amber-500" : "text-gray-400")}>
              {note.length}/500
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-4">
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => reason && onConfirm(reason, note.trim())}
            disabled={loading || !reason}
            className="flex min-w-[90px] items-center justify-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</> : "Reject"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Request-edit modal (text only)
// ---------------------------------------------------------------------------

interface EditRequestModalProps {
  loading:   boolean;
  onConfirm: (text: string) => void;
  onClose:   () => void;
}

function EditRequestModal({ loading, onConfirm, onClose }: EditRequestModalProps) {
  const [text, setText]   = useState("");
  const textareaRef        = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { textareaRef.current?.focus(); }, []);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50">
              <PencilLine className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Request Edit</h3>
              <p className="mt-0.5 text-xs text-gray-400">Describe exactly what needs to be corrected.</p>
            </div>
          </div>
          <button onClick={onClose} disabled={loading} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 transition-colors disabled:opacity-50">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4">
          <textarea
            ref={textareaRef}
            rows={4}
            maxLength={500}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. GPS location is missing, please log the visit again with location enabled…"
            className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
          />
          <div className="mt-1.5 flex justify-between">
            <p className="text-[11px] text-gray-400">Press Esc to cancel</p>
            <p className={cn("text-[11px]", text.length >= 450 ? "text-amber-500" : "text-gray-400")}>{text.length}/500</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-4">
          <button onClick={onClose} disabled={loading} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button
            onClick={() => text.trim() && onConfirm(text.trim())}
            disabled={loading || !text.trim()}
            className="flex min-w-[90px] items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
          >
            {loading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</> : "Send Back"}
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
  CALL:      <Phone         className="h-3.5 w-3.5" />,
  VISIT:     <MapPin        className="h-3.5 w-3.5" />,
  NOTE:      <StickyNote    className="h-3.5 w-3.5" />,
  EMAIL:     <Mail          className="h-3.5 w-3.5" />,
  WHATSAPP:  <MessageSquare className="h-3.5 w-3.5" />,
};

const TYPE_COLOR: Record<InteractionType, string> = {
  CALL:     "bg-blue-50    text-blue-700",
  VISIT:    "bg-emerald-50 text-emerald-700",
  NOTE:     "bg-amber-50   text-amber-700",
  EMAIL:    "bg-sky-50     text-sky-700",
  WHATSAPP: "bg-green-50   text-green-700",
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
  busyId:        string | null;
  onApprove:     (id: string) => void;
  onReject:      (id: string) => void;
  onRequestEdit: (id: string) => void;
}

function ActionCell({ row, busyId, onApprove, onReject, onRequestEdit }: ActionCellProps) {
  const busy = busyId === row.id;

  return (
    <div className="flex items-center justify-end gap-1.5">
      <button
        onClick={() => onApprove(row.id)}
        disabled={!!busyId}
        title="Approve"
        className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
        Approve
      </button>
      <button
        onClick={() => onRequestEdit(row.id)}
        disabled={!!busyId}
        title="Request Edit"
        className="flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <PencilLine className="h-3.5 w-3.5" />
        Edit
      </button>
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
// Filter bar (enhanced)
// ---------------------------------------------------------------------------

type StatusFilter = "ALL" | "PENDING" | "EDIT_REQUESTED";
type TypeFilter   = "ALL" | InteractionType;

interface FilterBarProps {
  statusFilter: StatusFilter;
  typeFilter:   TypeFilter;
  staffFilter:  string;
  clientFilter: string;
  dateFrom:     string;
  dateTo:       string;
  staffOptions:  { id: string; name: string }[];
  clientOptions: { id: string; name: string }[];
  counts: { all: number; pending: number; editRequested: number };
  onStatus:  (s: StatusFilter) => void;
  onType:    (t: TypeFilter) => void;
  onStaff:   (id: string) => void;
  onClient:  (id: string) => void;
  onDateFrom:(v: string) => void;
  onDateTo:  (v: string) => void;
  onClear:   () => void;
}

function FilterBar(p: FilterBarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const hasAdvanced = p.staffFilter || p.clientFilter || p.dateFrom || p.dateTo;

  const tabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: "ALL",            label: "All",           count: p.counts.all },
    { key: "PENDING",        label: "Pending",        count: p.counts.pending },
    { key: "EDIT_REQUESTED", label: "Edit Requested", count: p.counts.editRequested },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Status tabs */}
        <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => p.onStatus(tab.key)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                p.statusFilter === tab.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900",
              )}
            >
              {tab.label}
              <span className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                p.statusFilter === tab.key ? "bg-indigo-100 text-indigo-700" : "bg-gray-200 text-gray-500",
              )}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Type pills */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400">Type:</span>
            {(["ALL", "CALL", "VISIT", "NOTE", "EMAIL", "WHATSAPP"] as TypeFilter[]).map((t) => (
              <button
                key={t}
                onClick={() => p.onType(t)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                  p.typeFilter === t ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                )}
              >
                {t === "ALL" ? "All" : t.charAt(0) + t.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Advanced filter toggle */}
          <button
            onClick={() => setShowAdvanced((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
              hasAdvanced
                ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
            )}
          >
            <Filter className="h-3.5 w-3.5" />
            Filters
            {hasAdvanced && <span className="rounded-full bg-indigo-600 px-1.5 text-[10px] text-white">•</span>}
          </button>
        </div>
      </div>

      {/* Advanced filters panel */}
      {showAdvanced && (
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 md:grid-cols-4">
          {/* Staff filter */}
          <div>
            <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-gray-500">
              <User className="h-3 w-3" /> Staff
            </label>
            <select
              value={p.staffFilter}
              onChange={(e) => p.onStaff(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <option value="">All Staff</option>
              {p.staffOptions.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Client filter */}
          <div>
            <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-gray-500">
              <Users className="h-3 w-3" /> Client
            </label>
            <select
              value={p.clientFilter}
              onChange={(e) => p.onClient(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <option value="">All Clients</option>
              {p.clientOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Date from */}
          <div>
            <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-gray-500">
              <CalendarDays className="h-3 w-3" /> Created From
            </label>
            <input
              type="date"
              value={p.dateFrom}
              onChange={(e) => p.onDateFrom(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          {/* Date to */}
          <div>
            <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-gray-500">
              <CalendarDays className="h-3 w-3" /> Created To
            </label>
            <input
              type="date"
              value={p.dateTo}
              onChange={(e) => p.onDateTo(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          {hasAdvanced && (
            <div className="col-span-full flex justify-end">
              <button
                onClick={p.onClear}
                className="text-xs font-medium text-indigo-500 hover:text-indigo-700 transition-colors"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bulk action toolbar
// ---------------------------------------------------------------------------

interface BulkToolbarProps {
  selectedCount: number;
  totalCount:    number;
  allSelected:   boolean;
  someSelected:  boolean;
  bulkBusy:      boolean;
  onSelectAll:   () => void;
  onClearSel:    () => void;
  onBulkApprove: () => void;
  onBulkReject:  () => void;
  onBulkEdit:    () => void;
}

function BulkToolbar(p: BulkToolbarProps) {
  if (p.selectedCount === 0) return null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
      {/* Selection info + toggle */}
      <button
        onClick={p.onClearSel}
        className="flex items-center gap-2 text-xs font-semibold text-indigo-700"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded bg-indigo-600 text-white text-[10px]">
          {p.selectedCount}
        </span>
        selected
        <X className="h-3.5 w-3.5 text-indigo-400" />
      </button>

      <div className="h-4 w-px bg-indigo-200" />

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={p.onBulkApprove}
          disabled={p.bulkBusy}
          className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
        >
          {p.bulkBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          Approve selected
        </button>
        <button
          onClick={p.onBulkEdit}
          disabled={p.bulkBusy}
          className="flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
        >
          <PencilLine className="h-3.5 w-3.5" />
          Request Edit
        </button>
        <button
          onClick={p.onBulkReject}
          disabled={p.bulkBusy}
          className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
        >
          <XCircle className="h-3.5 w-3.5" />
          Reject selected
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal state discriminated union
// ---------------------------------------------------------------------------

type ModalState =
  | { kind: "reject";       id: string | null }   // null = bulk
  | { kind: "request-edit"; id: string | null }   // null = bulk
  | null;

// ---------------------------------------------------------------------------
// Main dashboard
// ---------------------------------------------------------------------------

export function ReviewsDashboard({
  initialRows,
  initialTotal,
}: {
  initialRows:  ReviewRow[];
  initialTotal: number;
}) {
  const { patch, post } = useApiClient();
  const router          = useRouter();
  const { toasts, push, dismiss } = useToast();

  const [rows,         setRows]         = useState<ReviewRow[]>(initialRows);
  const [total,        setTotal]        = useState(initialTotal);
  const [modal,        setModal]        = useState<ModalState>(null);
  const [busyId,       setBusyId]       = useState<string | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [bulkBusy,     setBulkBusy]     = useState(false);
  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set());

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [typeFilter,   setTypeFilter]   = useState<TypeFilter>("ALL");
  const [staffFilter,  setStaffFilter]  = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [dateFrom,     setDateFrom]     = useState("");
  const [dateTo,       setDateTo]       = useState("");

  // SLA sort: null = no sort, "desc" = most overdue first, "asc" = freshest first
  const [slaSort, setSlaSort] = useState<"desc" | "asc" | null>("desc");

  // Derived counts
  const pendingCount       = rows.filter((r) => !r.rejected && !r.ownerNote).length;
  const editRequestedCount = rows.filter((r) => !r.rejected && !!r.ownerNote).length;

  // Derive unique staff / client options for filter dropdowns
  const staffOptions = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => {
      if (r.staff) map.set(r.staff.id, `${r.staff.firstName} ${r.staff.lastName}`);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const clientOptions = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => {
      if (r.client) map.set(r.client.id, `${r.client.firstName} ${r.client.lastName} — ${r.client.company}`);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  // Client-side filtered + sorted view
  const visible = useMemo(() => {
    const filtered = rows.filter((r) => {
    const s = deriveStatus(r);
    if (statusFilter === "PENDING"        && s !== "PENDING")        return false;
    if (statusFilter === "EDIT_REQUESTED" && s !== "EDIT_REQUESTED") return false;
    if (typeFilter !== "ALL" && r.type !== typeFilter) return false;
    if (staffFilter  && r.staff?.id  !== staffFilter)  return false;
    if (clientFilter && r.client?.id !== clientFilter) return false;
      if (dateFrom) {
        const created = new Date(r.createdAt).getTime();
        if (created < new Date(dateFrom).getTime()) return false;
      }
      if (dateTo) {
        const created = new Date(r.createdAt).getTime();
        if (created > new Date(dateTo + "T23:59:59").getTime()) return false;
      }
      return true;
    });

    if (!slaSort) return filtered;

    // Sort by SLA hours: PENDING rows sorted by age, non-PENDING rows go to bottom
    return [...filtered].sort((a, b) => {
      const aHours = getSlaInfo(a.createdAt, a.reviewStatus)?.hours ?? -1;
      const bHours = getSlaInfo(b.createdAt, b.reviewStatus)?.hours ?? -1;
      return slaSort === "desc" ? bHours - aHours : aHours - bHours;
    });
  }, [rows, statusFilter, typeFilter, staffFilter, clientFilter, dateFrom, dateTo, slaSort]);

  const visibleIds        = useMemo(() => new Set(visible.map((r) => r.id)), [visible]);
  const actionableVisible = useMemo(() => visible.filter((r) => !r.rejected), [visible]);
  const allSelected       = actionableVisible.length > 0 && actionableVisible.every((r) => selectedIds.has(r.id));
  const someSelected      = actionableVisible.some((r) => selectedIds.has(r.id));

  // Clear selections when filter changes
  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => { if (visibleIds.has(id)) next.add(id); });
      return next;
    });
  }, [visibleIds]);

  // -------------------------------------------------------------------------
  // Selection helpers
  // -------------------------------------------------------------------------

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(actionableVisible.map((r) => r.id)));
    }
  }

  function clearSelection() { setSelectedIds(new Set()); }

  // -------------------------------------------------------------------------
  // Single-row actions
  // -------------------------------------------------------------------------

  async function approve(id: string) {
    setBusyId(id);
    try {
      await patch(`/api/interactions/${id}/approve`);
      setRows((prev) => prev.filter((r) => r.id !== id));
      setTotal((t) => t - 1);
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
      push("Interaction approved", "success");
      router.refresh();
    } catch {
      push("Approve failed — please try again", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string, reason: string, note: string) {
    setModalLoading(true);
    try {
      await patch(`/api/interactions/${id}/reject`, { reason, note: note || undefined });
      setRows((prev) => prev.filter((r) => r.id !== id));
      setTotal((t) => t - 1);
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
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
          r.id === id ? { ...r, ownerNote: instructions, rejected: false, reviewStatus: "EDIT_REQUESTED" } : r,
        ),
      );
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
      setModal(null);
      push("Edit request sent", "info");
    } catch {
      push("Request edit failed — please try again", "error");
    } finally {
      setModalLoading(false);
    }
  }

  // -------------------------------------------------------------------------
  // Bulk actions
  // -------------------------------------------------------------------------

  async function bulkAction(action: "approve" | "reject" | "request-edit", reason?: string, note?: string) {
    const ids = Array.from(selectedIds).filter((id) => {
      const row = rows.find((r) => r.id === id);
      return row && !row.rejected;
    });
    if (ids.length === 0) return;

    setBulkBusy(true);
    try {
      const result = await post<{ success: boolean; count: number }>("/api/interactions/bulk", {
        ids, action, reason, note,
      });
      const count = result.count ?? ids.length;

      if (action === "approve") {
        setRows((prev) => prev.filter((r) => !ids.includes(r.id)));
        setTotal((t) => t - count);
      } else if (action === "reject") {
        setRows((prev) => prev.filter((r) => !ids.includes(r.id)));
        setTotal((t) => t - count);
      } else {
        const noteText = note ?? "Please review and resubmit.";
        setRows((prev) =>
          prev.map((r) =>
            ids.includes(r.id)
              ? { ...r, ownerNote: noteText, rejected: false, reviewStatus: "EDIT_REQUESTED" }
              : r,
          ),
        );
      }

      clearSelection();
      setModal(null);
      push(
        action === "approve"
          ? `${count} interaction${count !== 1 ? "s" : ""} approved`
          : action === "reject"
          ? `${count} interaction${count !== 1 ? "s" : ""} rejected`
          : `Edit requested for ${count} interaction${count !== 1 ? "s" : ""}`,
        action === "approve" ? "success" : "info",
      );
      router.refresh();
    } catch {
      push("Bulk action failed — please try again", "error");
    } finally {
      setBulkBusy(false);
    }
  }

  function clearAllFilters() {
    setStatusFilter("ALL");
    setTypeFilter("ALL");
    setStaffFilter("");
    setClientFilter("");
    setDateFrom("");
    setDateTo("");
    setSlaSort("desc");
  }

  const hasFilters = statusFilter !== "ALL" || typeFilter !== "ALL" || staffFilter || clientFilter || dateFrom || dateTo;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <>
      <ToastStack toasts={toasts} onDismiss={dismiss} />

      {/* Reject modal — single or bulk */}
      {modal?.kind === "reject" && (
        <RejectModal
          loading={modalLoading || bulkBusy}
          onConfirm={(reason, note) =>
            modal.id ? reject(modal.id, reason, note) : bulkAction("reject", reason, note)
          }
          onClose={() => setModal(null)}
        />
      )}

      {/* Request-edit modal — single or bulk */}
      {modal?.kind === "request-edit" && (
        <EditRequestModal
          loading={modalLoading || bulkBusy}
          onConfirm={(text) =>
            modal.id ? requestEdit(modal.id, text) : bulkAction("request-edit", undefined, text)
          }
          onClose={() => setModal(null)}
        />
      )}

      <div className="space-y-4">
        {/* Filter bar */}
        <FilterBar
          statusFilter={statusFilter}
          typeFilter={typeFilter}
          staffFilter={staffFilter}
          clientFilter={clientFilter}
          dateFrom={dateFrom}
          dateTo={dateTo}
          staffOptions={staffOptions}
          clientOptions={clientOptions}
          counts={{ all: rows.length, pending: pendingCount, editRequested: editRequestedCount }}
          onStatus={setStatusFilter}
          onType={setTypeFilter}
          onStaff={setStaffFilter}
          onClient={setClientFilter}
          onDateFrom={setDateFrom}
          onDateTo={setDateTo}
          onClear={clearAllFilters}
        />

        {/* Bulk toolbar */}
        <BulkToolbar
          selectedCount={selectedIds.size}
          totalCount={actionableVisible.length}
          allSelected={allSelected}
          someSelected={someSelected}
          bulkBusy={bulkBusy}
          onSelectAll={toggleSelectAll}
          onClearSel={clearSelection}
          onBulkApprove={() => bulkAction("approve")}
          onBulkReject={() => setModal({ kind: "reject", id: null })}
          onBulkEdit={() => setModal({ kind: "request-edit", id: null })}
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
                {hasFilters ? "No interactions match the current filters." : "No interactions pending review."}
              </p>
            </div>
            {hasFilters && (
              <button
                onClick={clearAllFilters}
                className="mt-1 text-xs font-medium text-indigo-500 hover:text-indigo-700 transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  {/* Select-all checkbox */}
                  <th className="px-3 py-3">
                    <button onClick={toggleSelectAll} className="text-gray-400 hover:text-gray-600 transition-colors">
                      {allSelected ? (
                        <CheckSquare className="h-4 w-4 text-indigo-600" />
                      ) : someSelected ? (
                        <Minus className="h-4 w-4 text-indigo-400" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                  </th>
                  {["Type", "Client", "Staff", "Date"].map((label) => (
                    <th
                      key={label}
                      className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 whitespace-nowrap"
                    >
                      {label}
                    </th>
                  ))}

                  {/* SLA — sortable column */}
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 whitespace-nowrap">
                    <button
                      onClick={() => setSlaSort((s) => s === "desc" ? "asc" : s === "asc" ? null : "desc")}
                      className={cn(
                        "inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors",
                        slaSort ? "text-indigo-600" : "hover:text-gray-600",
                      )}
                      title="Sort by SLA age"
                    >
                      SLA
                      <span className="text-[9px] leading-none">
                        {slaSort === "desc" ? "↓" : slaSort === "asc" ? "↑" : "↕"}
                      </span>
                    </button>
                  </th>

                  {["Outcome", "Notes", "Status", "Owner Note"].map((label) => (
                    <th
                      key={label}
                      className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400"
                    >
                      {label}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-50">
                {visible.map((row) => {
                  const status     = deriveStatus(row);
                  const scfg       = STATUS_CONFIG[status];
                  const isRejected = status === "REJECTED";
                  const isSelected = selectedIds.has(row.id);

                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        "transition-colors hover:bg-gray-50/60",
                        isRejected && "opacity-50",
                        busyId === row.id && "bg-indigo-50/30",
                        isSelected && "bg-indigo-50/40",
                      )}
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-3.5">
                        {!isRejected && (
                          <button
                            onClick={() => toggleSelect(row.id)}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            {isSelected
                              ? <CheckSquare className="h-4 w-4 text-indigo-600" />
                              : <Square className="h-4 w-4" />
                            }
                          </button>
                        )}
                      </td>

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
                        ) : <span className="text-gray-300">—</span>}
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
                        ) : <span className="text-gray-300">—</span>}
                      </td>

                      {/* Date */}
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <p className="text-xs text-gray-600">{formatDate(row.date)}</p>
                        {row.duration != null && (
                          <p className="text-[11px] text-gray-400">{row.duration} min</p>
                        )}
                      </td>

                      {/* SLA — Date → SLA → Outcome */}
                      <td className="px-4 py-3.5">
                        <SlaBadge createdAt={row.createdAt} reviewStatus={row.reviewStatus} />
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
                        {row.reviewReason && (
                          <p className="mt-0.5 text-[10px] text-gray-400">{row.reviewReason}</p>
                        )}
                      </td>

                      {/* Owner note (expandable) */}
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
              {hasFilters && (
                <button
                  onClick={clearAllFilters}
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
