"use client";

import { useState, useMemo, useCallback } from "react";
import {
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
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { EventDetailDrawer } from "../EventDetailDrawer";
import type { TimelineEvent, TimelineEventType } from "@/modules/customer360/types/timeline.types";
import type { TimelineSource } from "@/modules/customer360/services/timeline.service";

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

// ─── Icon registry ────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Phone, MapPin, StickyNote, Mail, MessageCircle,
  FolderKanban, CheckCircle2, PauseCircle, ReceiptText,
  BadgeCheck, AlertCircle, Banknote, MessageSquareWarning, ShieldCheck,
};

function EventIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name] ?? Activity;
  return <Icon className={cn("h-4 w-4", className)} />;
}

// ─── Per-type colour scheme ───────────────────────────────────────────────────

type EventStyle = {
  iconBg:    string;
  iconText:  string;
  dot:       string;
  badgeBg:   string;
  badgeText: string;
  label:     string;
};

const EVENT_STYLE: Record<TimelineEventType, EventStyle> = {
  CALL:               { iconBg: "bg-blue-50",    iconText: "text-blue-600",    dot: "bg-blue-500",    badgeBg: "bg-blue-50",    badgeText: "text-blue-700",    label: "Call"       },
  VISIT:              { iconBg: "bg-emerald-50",  iconText: "text-emerald-600", dot: "bg-emerald-500", badgeBg: "bg-emerald-50",  badgeText: "text-emerald-700", label: "Visit"      },
  NOTE:               { iconBg: "bg-amber-50",    iconText: "text-amber-600",   dot: "bg-amber-500",   badgeBg: "bg-amber-50",    badgeText: "text-amber-700",   label: "Note"       },
  EMAIL:              { iconBg: "bg-sky-50",      iconText: "text-sky-600",     dot: "bg-sky-500",     badgeBg: "bg-sky-50",      badgeText: "text-sky-700",     label: "Email"      },
  WHATSAPP:           { iconBg: "bg-green-50",    iconText: "text-green-600",   dot: "bg-green-500",   badgeBg: "bg-green-50",    badgeText: "text-green-700",   label: "WhatsApp"   },
  PROJECT_CREATED:    { iconBg: "bg-violet-50",   iconText: "text-violet-600",  dot: "bg-violet-500",  badgeBg: "bg-violet-50",   badgeText: "text-violet-700",  label: "Project"    },
  PROJECT_COMPLETED:  { iconBg: "bg-violet-50",   iconText: "text-violet-600",  dot: "bg-violet-500",  badgeBg: "bg-violet-50",   badgeText: "text-violet-700",  label: "Completed"  },
  PROJECT_ON_HOLD:    { iconBg: "bg-orange-50",   iconText: "text-orange-600",  dot: "bg-orange-400",  badgeBg: "bg-orange-50",   badgeText: "text-orange-700",  label: "On Hold"    },
  INVOICE_ISSUED:     { iconBg: "bg-teal-50",     iconText: "text-teal-600",    dot: "bg-teal-500",    badgeBg: "bg-teal-50",     badgeText: "text-teal-700",    label: "Invoice"    },
  INVOICE_PAID:       { iconBg: "bg-green-50",    iconText: "text-green-600",   dot: "bg-green-500",   badgeBg: "bg-green-50",    badgeText: "text-green-700",   label: "Paid"       },
  INVOICE_OVERDUE:    { iconBg: "bg-red-50",      iconText: "text-red-600",     dot: "bg-red-500",     badgeBg: "bg-red-50",      badgeText: "text-red-700",     label: "Overdue"    },
  PAYMENT_RECEIVED:   { iconBg: "bg-green-50",    iconText: "text-green-600",   dot: "bg-green-500",   badgeBg: "bg-green-50",    badgeText: "text-green-700",   label: "Payment"    },
  COMPLAINT_RAISED:   { iconBg: "bg-rose-50",     iconText: "text-rose-600",    dot: "bg-rose-500",    badgeBg: "bg-rose-50",     badgeText: "text-rose-700",    label: "Complaint"  },
  COMPLAINT_RESOLVED: { iconBg: "bg-green-50",    iconText: "text-green-600",   dot: "bg-green-500",   badgeBg: "bg-green-50",    badgeText: "text-green-700",   label: "Resolved"   },
};

// ─── Metadata chips ───────────────────────────────────────────────────────────

function MetaChips({ event }: { event: TimelineEvent }) {
  const m = event.metadata;

  if (m.kind === "interaction") {
    // EMAIL / WHATSAPP: show direction badge instead of approval
    if (m.direction) {
      return (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {m.direction === "INBOUND" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700 ring-1 ring-inset ring-sky-200">
              <ArrowDownLeft className="h-2.5 w-2.5" /> Received
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-200">
              <ArrowUpRight className="h-2.5 w-2.5" /> Sent
            </span>
          )}
        </div>
      );
    }

    const approval = m.approved ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
        <CheckCircle2 className="h-2.5 w-2.5" /> Approved
      </span>
    ) : m.rejected ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700 ring-1 ring-inset ring-red-200">
        <XCircle className="h-2.5 w-2.5" /> Rejected
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-0.5 text-[10px] font-semibold text-gray-500 ring-1 ring-inset ring-gray-200">
        <Clock className="h-2.5 w-2.5" /> Pending
      </span>
    );

    return (
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {approval}
        {m.duration != null && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
            {m.duration} min
          </span>
        )}
      </div>
    );
  }

  if (m.kind === "complaint") {
    const PRIORITY_STYLE: Record<string, string> = {
      LOW:      "bg-gray-100 text-gray-600",
      MEDIUM:   "bg-amber-50 text-amber-700",
      HIGH:     "bg-orange-50 text-orange-700",
      CRITICAL: "bg-red-50 text-red-700",
    };
    return (
      <div className="mt-2">
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", PRIORITY_STYLE[m.priority] ?? "bg-gray-100 text-gray-600")}>
          {m.priority.charAt(0) + m.priority.slice(1).toLowerCase()} priority
        </span>
      </div>
    );
  }

  return null;
}

// ─── Single event row ─────────────────────────────────────────────────────────

function EventRow({
  event,
  isLast,
  onClick,
}: {
  event:   TimelineEvent;
  isLast:  boolean;
  onClick: (e: TimelineEvent) => void;
}) {
  const cfg = EVENT_STYLE[event.type];

  return (
    <div className="relative flex gap-4 pb-7 last:pb-0">
      {/* Connector line */}
      {!isLast && (
        <div className="absolute left-[19px] top-10 bottom-0 w-px bg-gray-100" />
      )}

      {/* Icon bubble */}
      <div className="relative z-10 shrink-0">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-full border-2 border-white shadow-sm", cfg.iconBg, cfg.iconText)}>
          <EventIcon name={event.icon} />
        </div>
        <span className={cn("absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white", cfg.dot)} />
      </div>

      {/* Content card — clickable */}
      <button
        onClick={() => onClick(event)}
        className="flex-1 min-w-0 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm ring-1 ring-black/[0.03] text-left transition-all hover:border-indigo-200 hover:shadow-md hover:ring-indigo-100 cursor-pointer"
      >
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", cfg.badgeBg, cfg.badgeText)}>
              {cfg.label}
            </span>
            <span className="text-sm font-semibold text-gray-800">{event.title}</span>
          </div>
          <time className="shrink-0 text-xs text-gray-400 tabular-nums">{formatDate(event.date)}</time>
        </div>

        {event.description && (
          <p className="mt-1.5 text-xs leading-relaxed text-gray-500">{event.description}</p>
        )}

        <MetaChips event={event} />
      </button>
    </div>
  );
}

// ─── Month divider ────────────────────────────────────────────────────────────

function MonthDivider({ label }: { label: string }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <div className="h-px flex-1 bg-gray-100" />
      <span className="shrink-0 text-[11px] font-bold uppercase tracking-widest text-gray-400">{label}</span>
      <div className="h-px flex-1 bg-gray-100" />
    </div>
  );
}

// ─── Stats summary strip ──────────────────────────────────────────────────────

function StatStrip({ timeline }: { timeline: TimelineEvent[] }) {
  const interactions = timeline.filter((e) => ["CALL", "VISIT", "NOTE", "EMAIL", "WHATSAPP"].includes(e.type)).length;
  const projects     = timeline.filter((e) => e.type.startsWith("PROJECT")).length;
  const finance      = timeline.filter((e) => e.type.startsWith("INVOICE") || e.type === "PAYMENT_RECEIVED").length;
  const complaints   = timeline.filter((e) => e.type.startsWith("COMPLAINT")).length;

  const stats = [
    { label: "Interactions", value: interactions, color: "text-blue-600",   bg: "bg-blue-50"   },
    { label: "Projects",     value: projects,     color: "text-violet-600", bg: "bg-violet-50" },
    { label: "Financial",    value: finance,      color: "text-teal-600",   bg: "bg-teal-50"   },
    { label: "Complaints",   value: complaints,   color: "text-rose-600",   bg: "bg-rose-50"   },
  ];

  return (
    <div className="grid grid-cols-4 gap-3">
      {stats.map((s) => (
        <div key={s.label} className={cn("flex flex-col items-center justify-center rounded-xl border border-gray-100 py-3 shadow-sm", s.bg)}>
          <span className={cn("text-xl font-bold", s.color)}>{s.value}</span>
          <span className="mt-0.5 text-[11px] font-medium text-gray-500">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Source filter bar ────────────────────────────────────────────────────────

const SOURCE_FILTERS: { key: TimelineSource; label: string; types: string[] }[] = [
  { key: "all",        label: "All",          types: [] },
  { key: "crm",        label: "Interactions", types: ["CALL", "VISIT", "NOTE", "EMAIL", "WHATSAPP"] },
  { key: "projects",   label: "Projects",     types: ["PROJECT_CREATED", "PROJECT_COMPLETED", "PROJECT_ON_HOLD"] },
  { key: "finance",    label: "Finance",      types: ["INVOICE_ISSUED", "INVOICE_PAID", "INVOICE_OVERDUE", "PAYMENT_RECEIVED"] },
  { key: "complaints", label: "Complaints",   types: ["COMPLAINT_RAISED", "COMPLAINT_RESOLVED"] },
];

function FilterBar({
  source,
  timeline,
  onChange,
}: {
  source:   TimelineSource;
  timeline: TimelineEvent[];
  onChange: (s: TimelineSource) => void;
}) {
  function countFor(types: string[]) {
    if (types.length === 0) return timeline.length;
    return timeline.filter((e) => types.includes(e.type)).length;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {SOURCE_FILTERS.map((f) => {
        const count   = countFor(f.types);
        const isActive = source === f.key;
        return (
          <button
            key={f.key}
            onClick={() => onChange(f.key)}
            disabled={count === 0 && f.key !== "all"}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
              isActive
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed",
            )}
          >
            {f.label}
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[9px] font-bold",
                isActive ? "bg-white/20 text-white" : "bg-white text-gray-600",
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

interface Props {
  timeline: TimelineEvent[];
  clientId: string;
}

export function TimelineTab({ timeline, clientId }: Props) {
  const [source,        setSource]        = useState<TimelineSource>("all");
  const [visibleCount,  setVisibleCount]  = useState(PAGE_SIZE);
  const [extraEvents,   setExtraEvents]   = useState<TimelineEvent[]>([]);
  const [nextCursor,    setNextCursor]    = useState<string | null>(null);
  const [fetching,      setFetching]      = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);

  // Combine server-loaded events with any additionally fetched events
  const allEvents = useMemo(() => {
    if (extraEvents.length === 0) return timeline;
    // Merge, re-sort, deduplicate by id
    const seen = new Set<string>();
    return [...timeline, ...extraEvents]
      .filter((e) => { if (seen.has(e.id)) return false; seen.add(e.id); return true; })
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [timeline, extraEvents]);

  // Client-side source filter — instant, no API call
  const filtered = useMemo(() => {
    if (source === "all") return allEvents;
    const allowed = SOURCE_FILTERS.find((f) => f.key === source)?.types ?? [];
    return allEvents.filter((e) => allowed.includes(e.type));
  }, [allEvents, source]);

  // Virtual pagination over the filtered list
  const visible = filtered.slice(0, visibleCount);
  const hasMoreLocal  = visibleCount < filtered.length;
  // There might be more on the server if the last fetch returned a cursor
  const hasMoreServer = !hasMoreLocal && (nextCursor !== null || (extraEvents.length === 0 && timeline.length > 0));

  // Reset visible count when filter changes
  function handleSourceChange(s: TimelineSource) {
    setSource(s);
    setVisibleCount(PAGE_SIZE);
  }

  // Expand virtual window (no network call)
  function showMoreLocal() {
    setVisibleCount((c) => c + PAGE_SIZE);
  }

  // Fetch additional events from the API beyond what the server page loaded
  const fetchMore = useCallback(async () => {
    setFetching(true);
    try {
      const lastEvent = filtered[filtered.length - 1];
      const cursor    = lastEvent
        ? `${lastEvent.date}::${lastEvent.id}`
        : undefined;

      const params = new URLSearchParams({ source, limit: "25" });
      if (cursor) params.set("cursor", cursor);

      const res  = await fetch(`/api/customers/${clientId}/timeline?${params}`);
      const data = await res.json() as { success: boolean; events: TimelineEvent[]; nextCursor: string | null };

      if (data.success && data.events.length > 0) {
        setExtraEvents((prev) => [...prev, ...data.events]);
        setNextCursor(data.nextCursor);
        setVisibleCount((c) => c + data.events.length);
      } else {
        setNextCursor(null);
      }
    } catch {
      // silently ignore — show nothing new
    } finally {
      setFetching(false);
    }
  }, [clientId, source, filtered]);

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (timeline.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
          <Clock className="h-7 w-7 text-gray-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-700">No activity yet</p>
          <p className="mt-1 text-xs text-gray-400">
            Log a call, visit, or note to start building the timeline.
          </p>
        </div>
      </div>
    );
  }

  // ── Group visible events by "Month Year" ─────────────────────────────────────
  const grouped = new Map<string, TimelineEvent[]>();
  for (const event of visible) {
    const key = new Date(event.date).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(event);
  }

  return (
    <>
      <div className="space-y-5">
        {/* Stats strip — always shows full-timeline counts */}
        <StatStrip timeline={timeline} />

        {/* Filter bar */}
        <FilterBar source={source} timeline={allEvents} onChange={handleSourceChange} />

        {/* Event count hint */}
        <p className="text-xs text-gray-400">
          Showing <span className="font-semibold text-gray-600">{visible.length}</span> of{" "}
          <span className="font-semibold text-gray-600">{filtered.length}</span> events
          {source !== "all" && " in this category"}
          {" · "}
          <span className="text-[11px]">Click any event for details</span>
        </p>

        {/* Empty filter state */}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <p className="text-sm font-medium text-gray-500">No events in this category yet.</p>
          </div>
        )}

        {/* Timeline feed */}
        {visible.length > 0 && (
          <div className="pt-1">
            {[...grouped.entries()].map(([month, events]) => (
              <div key={month} className="mb-2">
                <MonthDivider label={month} />
                <div>
                  {events.map((event, i) => (
                    <EventRow
                      key={event.id}
                      event={event}
                      isLast={i === events.length - 1}
                      onClick={setSelectedEvent}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Show more / Load more controls */}
        {(hasMoreLocal || hasMoreServer) && (
          <div className="flex justify-center pt-2">
            {hasMoreLocal ? (
              <button
                onClick={showMoreLocal}
                className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-600 shadow-sm transition-all hover:border-indigo-300 hover:text-indigo-600"
              >
                <ChevronDown className="h-4 w-4" />
                Show {Math.min(PAGE_SIZE, filtered.length - visibleCount)} more
              </button>
            ) : (
              <button
                onClick={fetchMore}
                disabled={fetching}
                className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-2.5 text-sm font-semibold text-indigo-700 shadow-sm transition-all hover:bg-indigo-100 disabled:opacity-60"
              >
                {fetching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                {fetching ? "Loading…" : "Load more from server"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Event detail drawer */}
      <EventDetailDrawer
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </>
  );
}
