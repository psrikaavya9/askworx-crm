"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Clock, AlertTriangle, CalendarClock, Snowflake,
  CheckCircle2, RefreshCw, ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const USER_ID = "admin";

type ReminderStatus = "PENDING" | "OVERDUE" | "COMPLETED" | "DISMISSED";
type ReminderType = "FOLLOW_UP" | "COLD_ALERT";

interface ReminderLead {
  id: string;
  firstName: string;
  lastName: string;
  company: string | null;
  stage: string;
  isCold: boolean;
  lastActivityAt: string | null;
}

interface Reminder {
  id: string;
  title: string;
  description: string | null;
  dueAt: string;
  type: ReminderType;
  status: ReminderStatus;
  lead: ReminderLead;
}

interface GroupedReminders {
  overdue: Reminder[];
  dueToday: Reminder[];
  upcoming: Reminder[];
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatRelative(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(ms);
  const m = Math.round(abs / 60000);
  const h = Math.round(abs / 3600000);
  const d = Math.round(abs / 86400000);
  const prefix = ms < 0 ? "" : "in ";
  const suffix = ms < 0 ? " ago" : "";
  if (m < 60) return `${prefix}${m}m${suffix}`;
  if (h < 24) return `${prefix}${h}h${suffix}`;
  return `${prefix}${d}d${suffix}`;
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ReminderStatus }) {
  const styles: Record<ReminderStatus, string> = {
    OVERDUE: "bg-red-100 text-red-700",
    PENDING: "bg-amber-100 text-amber-700",
    COMPLETED: "bg-green-100 text-green-700",
    DISMISSED: "bg-gray-100 text-gray-500",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", styles[status])}>
      {status.toLowerCase()}
    </span>
  );
}

function TypeBadge({ type }: { type: ReminderType }) {
  if (type === "COLD_ALERT") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
        <Snowflake className="h-2.5 w-2.5" /> Cold Alert
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-600">
      <Clock className="h-2.5 w-2.5" /> Follow-up
    </span>
  );
}

function ReminderCard({ reminder, onComplete }: { reminder: Reminder; onComplete: (id: string) => void }) {
  const [completing, setCompleting] = useState(false);
  const isOverdue = reminder.status === "OVERDUE" || (reminder.status === "PENDING" && new Date(reminder.dueAt) < new Date());

  async function handleComplete() {
    setCompleting(true);
    try {
      await fetch(`/api/crm/reminders/${reminder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      });
      onComplete(reminder.id);
    } catch {
      // ignore
    } finally {
      setCompleting(false);
    }
  }

  return (
    <div
      className={cn(
        "group rounded-xl border bg-white p-4 shadow-sm transition-all hover:shadow-md",
        isOverdue ? "border-red-200" : "border-gray-200"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className={cn(
            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
            reminder.type === "COLD_ALERT"
              ? "bg-slate-100 text-slate-500"
              : isOverdue
              ? "bg-red-100 text-red-600"
              : "bg-indigo-100 text-indigo-600"
          )}
        >
          {reminder.type === "COLD_ALERT" ? (
            <Snowflake className="h-4 w-4" />
          ) : isOverdue ? (
            <AlertTriangle className="h-4 w-4" />
          ) : (
            <Clock className="h-4 w-4" />
          )}
        </div>

        {/* Body */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-gray-900">{reminder.title}</p>
            <TypeBadge type={reminder.type} />
            <StatusBadge status={reminder.status} />
          </div>

          {reminder.description && (
            <p className="mt-1 text-sm text-gray-500">{reminder.description}</p>
          )}

          {/* Lead info */}
          <Link
            href={`/crm/leads/${reminder.lead.id}`}
            className="mt-2 flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:underline"
          >
            {reminder.lead.firstName} {reminder.lead.lastName}
            {reminder.lead.company ? ` · ${reminder.lead.company}` : ""}
            <ExternalLink className="h-3 w-3" />
          </Link>

          {/* Due date */}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-400">
            <span className={cn("font-medium", isOverdue ? "text-red-600" : "text-gray-500")}>
              {isOverdue ? "Was due" : "Due"}: {formatDate(reminder.dueAt)} ({formatRelative(reminder.dueAt)})
            </span>
            {reminder.lead.lastActivityAt && (
              <span>Last activity: {formatRelative(reminder.lead.lastActivityAt)}</span>
            )}
          </div>
        </div>

        {/* Action */}
        <button
          onClick={handleComplete}
          disabled={completing}
          title="Mark as complete"
          className="shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-green-50 hover:text-green-600 disabled:opacity-50"
        >
          {completing ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}

function EmptyTab({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
        <CheckCircle2 className="h-6 w-6 text-gray-400" />
      </div>
      <p className="text-sm font-medium text-gray-600">No {label} reminders</p>
      <p className="text-xs text-gray-400">You're all caught up here!</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────

type Tab = "overdue" | "dueToday" | "upcoming";

export default function CrmRemindersPage() {
  const [tab, setTab] = useState<Tab>("overdue");
  const [grouped, setGrouped] = useState<GroupedReminders | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/reminders/my?userId=${USER_ID}`);
      if (res.ok) setGrouped(await res.json() as GroupedReminders);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleComplete(id: string) {
    setGrouped((prev) => {
      if (!prev) return prev;
      function remove(list: Reminder[]) { return list.filter((r) => r.id !== id); }
      return { overdue: remove(prev.overdue), dueToday: remove(prev.dueToday), upcoming: remove(prev.upcoming) };
    });
  }

  const tabs: { key: Tab; label: string; count: number; icon: React.ReactNode }[] = [
    { key: "overdue", label: "Overdue", count: grouped?.overdue.length ?? 0, icon: <AlertTriangle className="h-3.5 w-3.5" /> },
    { key: "dueToday", label: "Due Today", count: grouped?.dueToday.length ?? 0, icon: <Clock className="h-3.5 w-3.5" /> },
    { key: "upcoming", label: "Upcoming", count: grouped?.upcoming.length ?? 0, icon: <CalendarClock className="h-3.5 w-3.5" /> },
  ];

  const currentList = grouped ? grouped[tab] : [];

  return (
    <div className="p-6">
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CRM Reminders</h1>
          <p className="mt-1 text-sm text-gray-500">Track follow-ups, cold alerts, and upcoming tasks.</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 shadow-sm transition-all hover:border-indigo-300 hover:text-indigo-600"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1">
        {tabs.map(({ key, label, count, icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-all",
              tab === key
                ? key === "overdue"
                  ? "bg-white text-red-600 shadow-sm"
                  : key === "dueToday"
                  ? "bg-white text-amber-600 shadow-sm"
                  : "bg-white text-indigo-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            {icon}
            {label}
            {count > 0 && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                  tab === key
                    ? key === "overdue"
                      ? "bg-red-100 text-red-700"
                      : key === "dueToday"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-indigo-100 text-indigo-700"
                    : "bg-gray-200 text-gray-600"
                )}
              >
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading && !grouped ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-gray-100 bg-gray-50" />
          ))}
        </div>
      ) : currentList.length === 0 ? (
        <EmptyTab label={tabs.find((t) => t.key === tab)?.label.toLowerCase() ?? ""} />
      ) : (
        <div className="space-y-3">
          {currentList.map((r) => (
            <ReminderCard key={r.id} reminder={r} onComplete={handleComplete} />
          ))}
        </div>
      )}
    </div>
  );
}
