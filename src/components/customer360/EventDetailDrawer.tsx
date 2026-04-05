"use client";

import { useEffect } from "react";
import {
  X,
  Phone,
  MapPin,
  StickyNote,
  Mail,
  MessageCircle,
  FolderKanban,
  CheckCircle2,
  PauseCircle,
  ReceiptText,
  BadgeCheck,
  AlertCircle,
  Banknote,
  MessageSquareWarning,
  ShieldCheck,
  Activity,
  Clock,
  XCircle,
  User,
  Timer,
  Calendar,
  ExternalLink,
  FileText,
  Tag,
  Hash,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import Link from "next/link";
import { cn, formatDate } from "@/lib/utils";
import type {
  TimelineEvent,
  TimelineEventType,
  InteractionMeta,
  ProjectMeta,
  InvoiceMeta,
  PaymentMeta,
  ComplaintMeta,
} from "@/modules/customer360/types/timeline.types";

// ─── Icon registry (mirrors TimelineTab) ─────────────────────────────────────

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Phone, MapPin, StickyNote, Mail, MessageCircle,
  FolderKanban, CheckCircle2, PauseCircle, ReceiptText,
  BadgeCheck, AlertCircle, Banknote, MessageSquareWarning, ShieldCheck,
};

function EventIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name] ?? Activity;
  return <Icon className={cn("h-5 w-5", className)} />;
}

// ─── Per-type styles ──────────────────────────────────────────────────────────

type EventStyle = { iconBg: string; iconText: string; badge: string; label: string };

const EVENT_STYLE: Record<TimelineEventType, EventStyle> = {
  CALL:               { iconBg: "bg-blue-100",   iconText: "text-blue-600",    badge: "bg-blue-100 text-blue-700",    label: "Call"              },
  VISIT:              { iconBg: "bg-emerald-100", iconText: "text-emerald-600", badge: "bg-emerald-100 text-emerald-700", label: "Visit"           },
  NOTE:               { iconBg: "bg-amber-100",   iconText: "text-amber-600",   badge: "bg-amber-100 text-amber-700",   label: "Note"             },
  EMAIL:              { iconBg: "bg-sky-100",     iconText: "text-sky-600",     badge: "bg-sky-100 text-sky-700",       label: "Email"            },
  WHATSAPP:           { iconBg: "bg-green-100",   iconText: "text-green-600",   badge: "bg-green-100 text-green-700",   label: "WhatsApp"         },
  PROJECT_CREATED:    { iconBg: "bg-violet-100",  iconText: "text-violet-600",  badge: "bg-violet-100 text-violet-700",  label: "Project Created"  },
  PROJECT_COMPLETED:  { iconBg: "bg-violet-100",  iconText: "text-violet-600",  badge: "bg-violet-100 text-violet-700",  label: "Project Completed"},
  PROJECT_ON_HOLD:    { iconBg: "bg-orange-100",  iconText: "text-orange-600",  badge: "bg-orange-100 text-orange-700",  label: "Project On Hold"  },
  INVOICE_ISSUED:     { iconBg: "bg-teal-100",    iconText: "text-teal-600",    badge: "bg-teal-100 text-teal-700",    label: "Invoice Issued"    },
  INVOICE_PAID:       { iconBg: "bg-green-100",   iconText: "text-green-600",   badge: "bg-green-100 text-green-700",   label: "Invoice Paid"     },
  INVOICE_OVERDUE:    { iconBg: "bg-red-100",     iconText: "text-red-600",     badge: "bg-red-100 text-red-700",     label: "Invoice Overdue"   },
  PAYMENT_RECEIVED:   { iconBg: "bg-green-100",   iconText: "text-green-600",   badge: "bg-green-100 text-green-700",   label: "Payment Received" },
  COMPLAINT_RAISED:   { iconBg: "bg-rose-100",    iconText: "text-rose-600",    badge: "bg-rose-100 text-rose-700",    label: "Complaint Raised"  },
  COMPLAINT_RESOLVED: { iconBg: "bg-green-100",   iconText: "text-green-600",   badge: "bg-green-100 text-green-700",   label: "Complaint Resolved"},
};

// ─── Detail rows ──────────────────────────────────────────────────────────────

function DetailRow({
  icon,
  label,
  value,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  if (!value && value !== 0) return null;
  return (
    <div className={cn("flex items-start gap-3 py-2.5", className)}>
      <span className="mt-0.5 shrink-0 text-gray-400">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
        <div className="mt-0.5 text-sm text-gray-800">{value}</div>
      </div>
    </div>
  );
}

// ─── Metadata panels ─────────────────────────────────────────────────────────

function InteractionDetails({ meta }: { meta: InteractionMeta }) {
  // EMAIL / WHATSAPP — show messaging-specific panel
  if (meta.direction !== null) {
    const directionBadge = meta.direction === "INBOUND" ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 ring-1 ring-inset ring-sky-200">
        <ArrowDownLeft className="h-3 w-3" /> Received
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-200">
        <ArrowUpRight className="h-3 w-3" /> Sent
      </span>
    );

    return (
      <div className="divide-y divide-gray-100">
        <DetailRow icon={<User className="h-4 w-4" />} label="Logged by" value={meta.staffName} />
        {meta.counterpartyEmail && (
          <DetailRow icon={<Mail className="h-4 w-4" />} label="Contact email" value={meta.counterpartyEmail} />
        )}
        {meta.counterpartyPhone && (
          <DetailRow icon={<MessageCircle className="h-4 w-4" />} label="Contact phone" value={meta.counterpartyPhone} />
        )}
        {meta.messageSubject && (
          <DetailRow icon={<Tag className="h-4 w-4" />} label="Subject" value={meta.messageSubject} />
        )}
        {meta.messagePreview && (
          <div className="py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Message</p>
            <p className="mt-1 max-h-40 overflow-y-auto rounded-lg bg-gray-50 p-3 text-sm leading-relaxed text-gray-700 whitespace-pre-wrap">
              {meta.messagePreview}
              {meta.messagePreview.length >= 300 && (
                <span className="text-gray-400"> …</span>
              )}
            </p>
          </div>
        )}
        <div className="py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Direction</p>
          <div className="mt-1.5">{directionBadge}</div>
        </div>
        {meta.externalId && (
          <DetailRow icon={<Hash className="h-4 w-4" />} label="Message ID" value={
            <span className="font-mono text-xs text-gray-500 break-all">{meta.externalId}</span>
          } />
        )}
      </div>
    );
  }

  // CALL / VISIT / NOTE — original approval-based panel
  const approval = meta.approved ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
      <CheckCircle2 className="h-3 w-3" /> Approved
    </span>
  ) : meta.rejected ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200">
      <XCircle className="h-3 w-3" /> Rejected
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 ring-1 ring-inset ring-gray-200">
      <Clock className="h-3 w-3" /> Pending review
    </span>
  );

  return (
    <div className="divide-y divide-gray-100">
      <DetailRow icon={<User className="h-4 w-4" />}    label="Logged by"    value={meta.staffName} />
      {meta.duration != null && (
        <DetailRow icon={<Timer className="h-4 w-4" />}    label="Duration"    value={`${meta.duration} min`} />
      )}
      {meta.outcome && (
        <DetailRow icon={<Tag className="h-4 w-4" />}      label="Outcome"     value={meta.outcome} />
      )}
      {meta.nextFollowUp && (
        <DetailRow icon={<Calendar className="h-4 w-4" />} label="Next follow-up" value={formatDate(meta.nextFollowUp as unknown as string)} />
      )}
      {meta.gpsLat != null && meta.gpsLng != null && (
        <DetailRow
          icon={<MapPin className="h-4 w-4" />}
          label="Location"
          value={
            <a
              href={`https://maps.google.com/?q=${meta.gpsLat},${meta.gpsLng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-indigo-600 hover:underline"
            >
              View on map <ExternalLink className="h-3 w-3" />
            </a>
          }
        />
      )}
      {meta.photoCount > 0 && (
        <DetailRow icon={<FileText className="h-4 w-4" />} label="Photos" value={`${meta.photoCount} attached`} />
      )}
      <div className="py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Approval status</p>
        <div className="mt-1.5">{approval}</div>
      </div>
    </div>
  );
}

function ProjectDetails({ meta }: { meta: ProjectMeta }) {
  const STATUS_STYLE: Record<string, string> = {
    PLANNING:  "bg-blue-50 text-blue-700",
    ACTIVE:    "bg-emerald-50 text-emerald-700",
    ON_HOLD:   "bg-orange-50 text-orange-700",
    COMPLETED: "bg-green-50 text-green-700",
  };

  return (
    <div className="divide-y divide-gray-100">
      <DetailRow icon={<FolderKanban className="h-4 w-4" />} label="Project name" value={meta.projectName} />
      <DetailRow
        icon={<Tag className="h-4 w-4" />}
        label="Status"
        value={
          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS_STYLE[meta.status] ?? "bg-gray-100 text-gray-600")}>
            {meta.status.replace(/_/g, " ")}
          </span>
        }
      />
      <DetailRow icon={<CheckCircle2 className="h-4 w-4" />} label="Tasks" value={`${meta.taskCount} task${meta.taskCount !== 1 ? "s" : ""}`} />
      {meta.deadline && (
        <DetailRow icon={<Calendar className="h-4 w-4" />} label="Deadline" value={formatDate(meta.deadline as unknown as string)} />
      )}
      <div className="py-3">
        <Link
          href={`/projects/${meta.projectId}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
        >
          Open project <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

function InvoiceDetails({ meta }: { meta: InvoiceMeta }) {
  const STATUS_STYLE: Record<string, string> = {
    DRAFT:   "bg-gray-100 text-gray-600",
    SENT:    "bg-blue-50 text-blue-700",
    PAID:    "bg-green-50 text-green-700",
    OVERDUE: "bg-red-50 text-red-700",
  };

  return (
    <div className="divide-y divide-gray-100">
      <DetailRow icon={<Hash className="h-4 w-4" />}       label="Invoice #"  value={meta.invoiceNumber} />
      <DetailRow
        icon={<Tag className="h-4 w-4" />}
        label="Status"
        value={
          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS_STYLE[meta.status] ?? "bg-gray-100 text-gray-600")}>
            {meta.status}
          </span>
        }
      />
      <DetailRow
        icon={<Banknote className="h-4 w-4" />}
        label="Amount"
        value={<span className="font-semibold">₹{Number(meta.totalAmount).toLocaleString("en-IN")}</span>}
      />
      <DetailRow icon={<Calendar className="h-4 w-4" />} label="Due date" value={formatDate(meta.dueDate as unknown as string)} />
      <div className="py-3">
        <Link
          href={`/finance/invoices/${meta.invoiceId}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
        >
          View invoice <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

function PaymentDetails({ meta }: { meta: PaymentMeta }) {
  const method = meta.paymentMethod.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="divide-y divide-gray-100">
      <DetailRow
        icon={<Banknote className="h-4 w-4" />}
        label="Amount paid"
        value={<span className="font-semibold text-green-700">₹{Number(meta.amount).toLocaleString("en-IN")}</span>}
      />
      <DetailRow icon={<Tag className="h-4 w-4" />}   label="Method"       value={method} />
      {meta.referenceNumber && (
        <DetailRow icon={<Hash className="h-4 w-4" />} label="Reference #"  value={meta.referenceNumber} />
      )}
      <DetailRow icon={<Hash className="h-4 w-4" />}   label="Against invoice" value={meta.invoiceNumber} />
      <div className="py-3">
        <Link
          href={`/finance/invoices/${meta.invoiceId}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
        >
          View invoice <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

function ComplaintDetails({ meta }: { meta: ComplaintMeta }) {
  const PRIORITY_STYLE: Record<string, string> = {
    LOW:      "bg-gray-100 text-gray-600",
    MEDIUM:   "bg-amber-50 text-amber-700",
    HIGH:     "bg-orange-50 text-orange-700",
    CRITICAL: "bg-red-100 text-red-700",
  };

  const STATUS_STYLE: Record<string, string> = {
    OPEN:        "bg-red-50 text-red-700",
    IN_PROGRESS: "bg-amber-50 text-amber-700",
    RESOLVED:    "bg-green-50 text-green-700",
    CLOSED:      "bg-gray-100 text-gray-600",
  };

  return (
    <div className="divide-y divide-gray-100">
      <DetailRow
        icon={<AlertCircle className="h-4 w-4" />}
        label="Priority"
        value={
          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", PRIORITY_STYLE[meta.priority] ?? "bg-gray-100 text-gray-600")}>
            {meta.priority.charAt(0) + meta.priority.slice(1).toLowerCase()}
          </span>
        }
      />
      <DetailRow
        icon={<Tag className="h-4 w-4" />}
        label="Status"
        value={
          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS_STYLE[meta.status] ?? "bg-gray-100 text-gray-600")}>
            {meta.status.replace(/_/g, " ")}
          </span>
        }
      />
      {meta.assignedTo && (
        <DetailRow icon={<User className="h-4 w-4" />} label="Assigned to" value={meta.assignedTo} />
      )}
      {meta.resolution && (
        <DetailRow icon={<CheckCircle2 className="h-4 w-4" />} label="Resolution" value={meta.resolution} />
      )}
    </div>
  );
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

interface Props {
  event:   TimelineEvent | null;
  onClose: () => void;
}

export function EventDetailDrawer({ event, onClose }: Props) {
  // Close on Escape key
  useEffect(() => {
    if (!event) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [event, onClose]);

  // Backdrop click to close
  if (!event) return null;

  const cfg = EVENT_STYLE[event.type];
  const m   = event.metadata;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px] transition-opacity"
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl ring-1 ring-black/10">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", cfg.iconBg, cfg.iconText)}>
            <EventIcon name={event.icon} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", cfg.badge)}>
                {cfg.label}
              </span>
            </div>
            <p className="mt-0.5 truncate text-sm font-bold text-gray-900">{event.title}</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Timestamp */}
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2.5">
            <Clock className="h-4 w-4 shrink-0 text-gray-400" />
            <time className="text-sm font-medium text-gray-700">{formatDate(event.date)}</time>
          </div>

          {/* Description */}
          {event.description && (
            <div className="mb-4 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
              <p className="text-sm leading-relaxed text-gray-600">{event.description}</p>
            </div>
          )}

          {/* Type-specific details */}
          <div className="rounded-xl border border-gray-100 bg-white px-4 shadow-sm">
            {m.kind === "interaction" && <InteractionDetails meta={m} />}
            {m.kind === "project"     && <ProjectDetails     meta={m} />}
            {m.kind === "invoice"     && <InvoiceDetails     meta={m} />}
            {m.kind === "payment"     && <PaymentDetails     meta={m} />}
            {m.kind === "complaint"   && <ComplaintDetails   meta={m} />}
          </div>
        </div>
      </div>
    </>
  );
}
