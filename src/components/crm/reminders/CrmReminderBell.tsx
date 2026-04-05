"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, Clock, AlertTriangle, CalendarClock, BellOff, ExternalLink } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const POLL_INTERVAL_MS = 60_000;
const USER_ID = "admin";

interface ReminderLead {
  id: string;
  firstName: string;
  lastName: string;
  company: string | null;
  stage: string;
  isCold: boolean;
}

interface Reminder {
  id: string;
  title: string;
  description: string | null;
  dueAt: string;
  type: "FOLLOW_UP" | "COLD_ALERT";
  status: string;
  lead: ReminderLead;
}

interface GroupedReminders {
  overdue: Reminder[];
  dueToday: Reminder[];
  upcoming: Reminder[];
}

function formatDueAt(dueAt: string): string {
  const d = new Date(dueAt);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffH = diffMs / (1000 * 60 * 60);

  if (diffH < 0) {
    const ago = Math.abs(diffH);
    if (ago < 1) return `${Math.round(ago * 60)}m overdue`;
    if (ago < 24) return `${Math.round(ago)}h overdue`;
    return `${Math.round(ago / 24)}d overdue`;
  }
  if (diffH < 1) return `in ${Math.round(diffH * 60)}m`;
  if (diffH < 24) return `in ${Math.round(diffH)}h`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ReminderItem({ reminder, section }: { reminder: Reminder; section: "overdue" | "dueToday" | "upcoming" }) {
  const isColdAlert = reminder.type === "COLD_ALERT";

  return (
    <Link
      href={`/crm/leads/${reminder.lead.id}`}
      className={cn(
        "group flex items-start gap-3 px-4 py-3 transition-colors",
        section === "overdue"
          ? "bg-red-50/40 hover:bg-red-50"
          : section === "dueToday"
          ? "bg-amber-50/30 hover:bg-amber-50"
          : "hover:bg-gray-50"
      )}
    >
      <div
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          section === "overdue"
            ? "bg-red-100 text-red-600"
            : section === "dueToday"
            ? "bg-amber-100 text-amber-600"
            : "bg-gray-100 text-gray-500"
        )}
      >
        {isColdAlert ? (
          <AlertTriangle className="h-4 w-4" />
        ) : section === "overdue" ? (
          <AlertTriangle className="h-4 w-4" />
        ) : (
          <Clock className="h-4 w-4" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-gray-800">{reminder.title}</p>
        <p className="mt-0.5 truncate text-[11px] text-gray-500">
          {reminder.lead.firstName} {reminder.lead.lastName}
          {reminder.lead.company ? ` · ${reminder.lead.company}` : ""}
        </p>
        <p
          className={cn(
            "mt-0.5 text-[10px] font-medium",
            section === "overdue" ? "text-red-600" : section === "dueToday" ? "text-amber-600" : "text-gray-400"
          )}
        >
          {formatDueAt(reminder.dueAt)}
        </p>
      </div>

      {isColdAlert && (
        <span className="mt-1 shrink-0 rounded-full bg-slate-200 px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-600">
          Cold
        </span>
      )}
    </Link>
  );
}

function SectionHeader({ label, count, variant }: { label: string; count: number; variant: "red" | "amber" | "gray" }) {
  if (count === 0) return null;
  const colors = {
    red: "text-red-700 bg-red-50",
    amber: "text-amber-700 bg-amber-50",
    gray: "text-gray-600 bg-gray-50",
  };
  return (
    <div className={cn("flex items-center justify-between border-b border-gray-100 px-4 py-1.5", colors[variant])}>
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-bold", colors[variant])}>{count}</span>
    </div>
  );
}

export function CrmReminderBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [grouped, setGrouped] = useState<GroupedReminders | null>(null);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(async () => {
    try {
      const res = await fetch(`/api/crm/reminders/count?userId=${USER_ID}`);
      if (res.ok) {
        const data = await res.json() as { count: number };
        setCount(data.count);
      }
    } catch {
      // Silently ignore — don't break the app if reminders API is down
    }
  }, []);

  useEffect(() => {
    refreshCount();
    const id = setInterval(refreshCount, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refreshCount]);

  const fetchGrouped = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/reminders/my?userId=${USER_ID}`);
      if (res.ok) {
        const data = await res.json() as GroupedReminders;
        setGrouped(data);
      }
    } catch {
      setGrouped(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) fetchGrouped();
  }, [isOpen, fetchGrouped]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [isOpen]);

  const hasCount = count > 0;
  const totalItems = grouped
    ? grouped.overdue.length + grouped.dueToday.length + grouped.upcoming.length
    : 0;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen((o) => !o)}
        className={cn(
          "relative rounded-lg p-2 transition-all",
          isOpen ? "bg-indigo-50 text-indigo-600" : "text-gray-500 hover:bg-indigo-50 hover:text-indigo-600"
        )}
        aria-label={`CRM Reminders${hasCount ? ` (${count} pending)` : ""}`}
      >
        <CalendarClock className="h-4 w-4" />
        {hasCount && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-indigo-500 px-0.5 text-[9px] font-bold text-white ring-2 ring-white">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl shadow-black/10"
          style={{ maxHeight: "30rem" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-indigo-600" />
              <span className="text-sm font-bold text-gray-900">CRM Reminders</span>
              {hasCount && (
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                  {count} pending
                </span>
              )}
            </div>
            <Link
              href="/crm/reminders"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-indigo-600 transition-colors hover:bg-indigo-50"
            >
              View all
              <ExternalLink className="h-2.5 w-2.5" />
            </Link>
          </div>

          {/* Content */}
          <div className="overflow-y-auto" style={{ maxHeight: "24rem" }}>
            {loading && !grouped ? (
              <div className="space-y-0">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3">
                    <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-gray-100" />
                    <div className="flex-1 space-y-2 pt-0.5">
                      <div className="h-2.5 w-5/6 animate-pulse rounded-full bg-gray-100" />
                      <div className="h-2 w-3/6 animate-pulse rounded-full bg-gray-100" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !grouped || totalItems === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                  <BellOff className="h-5 w-5 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-600">No reminders</p>
                <p className="text-xs text-gray-400">You're all caught up!</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {grouped.overdue.length > 0 && (
                  <>
                    <SectionHeader label="Overdue" count={grouped.overdue.length} variant="red" />
                    {grouped.overdue.map((r) => (
                      <ReminderItem key={r.id} reminder={r} section="overdue" />
                    ))}
                  </>
                )}
                {grouped.dueToday.length > 0 && (
                  <>
                    <SectionHeader label="Due Today" count={grouped.dueToday.length} variant="amber" />
                    {grouped.dueToday.map((r) => (
                      <ReminderItem key={r.id} reminder={r} section="dueToday" />
                    ))}
                  </>
                )}
                {grouped.upcoming.length > 0 && (
                  <>
                    <SectionHeader label="Upcoming" count={grouped.upcoming.length} variant="gray" />
                    {grouped.upcoming.slice(0, 5).map((r) => (
                      <ReminderItem key={r.id} reminder={r} section="upcoming" />
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          {totalItems > 0 && (
            <div className="border-t border-gray-100 px-4 py-2.5 text-center">
              <Link
                href="/crm/reminders"
                onClick={() => setIsOpen(false)}
                className="text-[11px] font-semibold text-indigo-600 hover:underline"
              >
                View all reminders →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
