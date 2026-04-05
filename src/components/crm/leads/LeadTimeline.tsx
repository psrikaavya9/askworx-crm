"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Mail, MessageCircle, Phone, StickyNote, ArrowRight,
  CheckCircle, XCircle, Plus, Calendar, FileText,
  ArrowDownLeft, ArrowUpRight, Loader2, RefreshCw,
} from "lucide-react";
import { timeAgo } from "@/lib/utils";
import type { TimelineEntry } from "@/app/api/crm/leads/[id]/timeline/route";

// ---------------------------------------------------------------------------
// Filter tabs
// ---------------------------------------------------------------------------

const FILTERS = [
  { key: null,        label: "All"       },
  { key: "EMAIL",     label: "Email"     },
  { key: "WHATSAPP",  label: "WhatsApp"  },
  { key: "CALL",      label: "Calls"     },
  { key: "NOTE",      label: "Notes"     },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

// ---------------------------------------------------------------------------
// Per-type config
// ---------------------------------------------------------------------------

type EntryType = TimelineEntry["type"];

const TYPE_CONFIG: Record<EntryType, {
  icon:    React.ReactNode;
  dotCls:  string;
  label:   string;
}> = {
  EMAIL:        { icon: <Mail           className="h-3.5 w-3.5" />, dotCls: "bg-sky-100   text-sky-600",   label: "Email"         },
  WHATSAPP:     { icon: <MessageCircle  className="h-3.5 w-3.5" />, dotCls: "bg-green-100 text-green-600", label: "WhatsApp"      },
  CALL:         { icon: <Phone          className="h-3.5 w-3.5" />, dotCls: "bg-violet-100 text-violet-600", label: "Call"        },
  NOTE:         { icon: <StickyNote     className="h-3.5 w-3.5" />, dotCls: "bg-yellow-100 text-yellow-600", label: "Note"        },
  STAGE_CHANGE: { icon: <ArrowRight     className="h-3.5 w-3.5" />, dotCls: "bg-blue-100  text-blue-600",  label: "Stage change"  },
  ACTIVITY:     { icon: <CheckCircle    className="h-3.5 w-3.5" />, dotCls: "bg-gray-100  text-gray-500",  label: "Activity"      },
};

// ---------------------------------------------------------------------------
// Direction badge
// ---------------------------------------------------------------------------

function DirectionBadge({ direction }: { direction: "INBOUND" | "OUTBOUND" | null }) {
  if (!direction) return null;
  const isIn = direction === "INBOUND";
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
      isIn ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"
    }`}>
      {isIn
        ? <ArrowDownLeft className="h-2.5 w-2.5" />
        : <ArrowUpRight  className="h-2.5 w-2.5" />}
      {isIn ? "Received" : "Sent"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Single timeline entry
// ---------------------------------------------------------------------------

function TimelineItem({ entry, isLast }: { entry: TimelineEntry; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = TYPE_CONFIG[entry.type] ?? TYPE_CONFIG.ACTIVITY;
  const hasPreview = !!entry.messagePreview;

  return (
    <li className="flex gap-3">
      {/* Dot + connector */}
      <div className="flex flex-col items-center">
        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${cfg.dotCls}`}>
          {cfg.icon}
        </div>
        {!isLast && <div className="mt-1 h-full w-px flex-1 bg-gray-100" />}
      </div>

      {/* Content */}
      <div className="pb-4 pt-0.5 min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-sm font-medium text-gray-800 truncate">{entry.title}</p>
          <DirectionBadge direction={entry.direction} />
        </div>

        {/* Subject line for emails */}
        {entry.subject && entry.type === "EMAIL" && (
          <p className="mt-0.5 text-xs text-gray-500 truncate">
            Subject: <span className="font-medium text-gray-700">{entry.subject}</span>
          </p>
        )}

        {/* Description (non-email/whatsapp) */}
        {!hasPreview && entry.description && entry.description !== entry.title && (
          <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">{entry.description}</p>
        )}

        {/* Message preview (email / WhatsApp) */}
        {hasPreview && (
          <div className="mt-1.5">
            <p className={`text-xs text-gray-600 ${expanded ? "" : "line-clamp-2"}`}>
              {entry.messagePreview}
            </p>
            {(entry.messagePreview?.length ?? 0) > 120 && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="mt-0.5 text-[11px] text-indigo-500 hover:text-indigo-700"
              >
                {expanded ? "Show less" : "Show more"}
              </button>
            )}
          </div>
        )}

        <p className="mt-1 text-[11px] text-gray-400">{timeAgo(entry.createdAt)}</p>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface LeadTimelineProps {
  leadId: string;
}

export function LeadTimeline({ leadId }: LeadTimelineProps) {
  const [entries,   setEntries]   = useState<TimelineEntry[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState<FilterKey>(null);
  const [error,     setError]     = useState<string | null>(null);

  const load = useCallback(async (type: FilterKey) => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/crm/leads/${leadId}/timeline${type ? `?type=${type}` : ""}`;
      const res  = await fetch(url);
      if (!res.ok) throw new Error("Failed to load timeline");
      const json = await res.json();
      setEntries(json.entries);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => { load(filter); }, [filter, load]);

  // Count badges per filter
  const counts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.type] = (acc[e.type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      {/* Filter tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {FILTERS.map(({ key, label }) => {
          const count = key
            ? (counts[key] ?? 0)
            : entries.length;
          const active = filter === key;
          return (
            <button
              key={String(key)}
              onClick={() => setFilter(key)}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                active
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {label}
              {count > 0 && (
                <span className={`rounded-full px-1 text-[10px] ${
                  active ? "bg-white/20 text-white" : "bg-gray-200 text-gray-500"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
        <button
          onClick={() => load(filter)}
          className="ml-auto rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
        </div>
      ) : error ? (
        <p className="py-6 text-center text-sm text-red-400">{error}</p>
      ) : entries.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">
          {filter ? `No ${filter.toLowerCase()} entries yet.` : "No activity yet."}
        </p>
      ) : (
        <ol className="space-y-0">
          {entries.map((entry, idx) => (
            <TimelineItem key={`${entry.source}-${entry.id}`} entry={entry} isLast={idx === entries.length - 1} />
          ))}
        </ol>
      )}
    </div>
  );
}
