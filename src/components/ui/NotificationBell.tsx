"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Bell, FileText, CheckCheck, Loader2, BellOff,
  ClipboardCheck, CheckCircle2, XCircle, PencilLine, Flame,
} from "lucide-react";
import {
  listNotifications,
  getNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  listAppNotifications,
  getAppNotificationCount,
  markAppNotificationRead,
  markAllAppNotificationsRead,
  timeAgo,
} from "@/lib/notification-api";
import type { VaultNotification, AppNotification } from "@/lib/notification-api";

// How often to poll for the unread count (ms).
const POLL_INTERVAL_MS = 60_000;

// ---------------------------------------------------------------------------
// Unified notification type
// ---------------------------------------------------------------------------

type UnifiedNotification =
  | { source: "vault"; data: VaultNotification }
  | { source: "app";   data: AppNotification };

function unifiedId(n: UnifiedNotification) {
  return `${n.source}:${n.data.id}`;
}

function unifiedIsRead(n: UnifiedNotification) {
  return n.data.isRead;
}

function unifiedCreatedAt(n: UnifiedNotification) {
  return n.data.createdAt;
}

function unifiedMessage(n: UnifiedNotification) {
  return n.data.message;
}

const APP_TYPE_ICON: Record<string, React.ReactNode> = {
  INTERACTION_REVIEW_NEEDED:  <ClipboardCheck className="h-4 w-4" />,
  INTERACTION_APPROVED:       <CheckCircle2   className="h-4 w-4" />,
  INTERACTION_REJECTED:       <XCircle        className="h-4 w-4" />,
  INTERACTION_EDIT_REQUESTED: <PencilLine     className="h-4 w-4" />,
  INTERACTION_ESCALATED:      <Flame          className="h-4 w-4" />,
};

const APP_TYPE_COLOR: Record<string, string> = {
  INTERACTION_REVIEW_NEEDED:  "bg-indigo-100 text-indigo-600",
  INTERACTION_APPROVED:       "bg-emerald-100 text-emerald-600",
  INTERACTION_REJECTED:       "bg-red-100 text-red-600",
  INTERACTION_EDIT_REQUESTED: "bg-amber-100 text-amber-600",
  INTERACTION_ESCALATED:      "bg-red-100 text-red-700",
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
        <BellOff className="h-5 w-5 text-gray-400" />
      </div>
      <p className="text-sm font-medium text-gray-600">No notifications</p>
      <p className="text-xs text-gray-400">You&apos;re all caught up!</p>
    </div>
  );
}

function NotificationItem({
  notification,
  onRead,
}: {
  notification: UnifiedNotification;
  onRead: (n: UnifiedNotification) => void;
}) {
  const isUnread = !unifiedIsRead(notification);

  let icon: React.ReactNode;
  let iconCls: string;

  if (notification.source === "app") {
    const type = (notification.data as AppNotification).type;
    icon    = APP_TYPE_ICON[type] ?? <ClipboardCheck className="h-4 w-4" />;
    iconCls = APP_TYPE_COLOR[type] ?? "bg-indigo-100 text-indigo-600";
  } else {
    icon    = <FileText className="h-4 w-4" />;
    iconCls = isUnread ? "bg-purple-100 text-purple-600" : "bg-gray-100 text-gray-400";
  }

  return (
    <button
      onClick={() => { if (isUnread) onRead(notification); }}
      className={`group w-full text-left transition-colors ${
        isUnread ? "bg-purple-50/60 hover:bg-purple-50" : "hover:bg-gray-50"
      }`}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          isUnread ? iconCls : "bg-gray-100 text-gray-400"
        }`}>
          {icon}
        </div>

        <div className="min-w-0 flex-1">
          <p className={`text-xs leading-relaxed ${isUnread ? "font-medium text-gray-800" : "text-gray-500"}`}>
            {unifiedMessage(notification)}
          </p>
          <p className="mt-1 text-[10px] text-gray-400">
            {timeAgo(unifiedCreatedAt(notification))}
          </p>
        </div>

        {isUnread && (
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-purple-500 ring-2 ring-white" />
        )}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function NotificationBell() {
  const [isOpen,        setIsOpen]        = useState(false);
  const [count,         setCount]         = useState(0);
  const [notifications, setNotifications] = useState<UnifiedNotification[]>([]);
  const [listLoading,   setListLoading]   = useState(false);
  const [markingAll,    setMarkingAll]    = useState(false);
  const [hasFetched,    setHasFetched]    = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // ── Fetch combined unread count ───────────────────────────────────────────

  const refreshCount = useCallback(async () => {
    try {
      const [vaultCount, appCount] = await Promise.all([
        getNotificationCount().then((r) => r.data.unreadCount).catch(() => 0),
        getAppNotificationCount(),
      ]);
      setCount(vaultCount + appCount);
    } catch {
      // Silently ignore
    }
  }, []);

  useEffect(() => {
    refreshCount();
    const id = setInterval(refreshCount, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refreshCount]);

  // ── Fetch combined list when dropdown opens ───────────────────────────────

  const fetchNotifications = useCallback(async () => {
    setListLoading(true);
    try {
      const [vaultItems, appItems] = await Promise.all([
        listNotifications({ limit: 20 }).then((r) => r.data).catch(() => [] as VaultNotification[]),
        listAppNotifications(20),
      ]);

      const unified: UnifiedNotification[] = [
        ...vaultItems.map((d): UnifiedNotification => ({ source: "vault", data: d })),
        ...appItems.map((d): UnifiedNotification => ({ source: "app", data: d })),
      ];

      // Sort newest first
      unified.sort((a, b) =>
        new Date(unifiedCreatedAt(b)).getTime() - new Date(unifiedCreatedAt(a)).getTime(),
      );

      setNotifications(unified.slice(0, 30));
      setHasFetched(true);
    } catch {
      setNotifications([]);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) fetchNotifications();
  }, [isOpen, fetchNotifications]);

  // ── Click outside to close ───────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;
    function handleOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen]);

  // ── Mark single notification as read ─────────────────────────────────────

  function handleMarkRead(n: UnifiedNotification) {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((x) =>
        unifiedId(x) === unifiedId(n)
          ? { ...x, data: { ...x.data, isRead: true } } as UnifiedNotification
          : x,
      ),
    );
    setCount((c) => Math.max(0, c - 1));

    if (n.source === "vault") {
      markNotificationRead(n.data.id).catch(() => {
        setNotifications((prev) =>
          prev.map((x) =>
            unifiedId(x) === unifiedId(n)
              ? { ...x, data: { ...x.data, isRead: false } } as UnifiedNotification
              : x,
          ),
        );
        setCount((c) => c + 1);
      });
    } else {
      markAppNotificationRead(n.data.id).catch(() => null);
    }
  }

  // ── Mark all as read ─────────────────────────────────────────────────────

  async function handleMarkAllRead() {
    if (markingAll || count === 0) return;
    setMarkingAll(true);
    try {
      await Promise.all([
        markAllNotificationsRead(),
        markAllAppNotificationsRead(),
      ]);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, data: { ...n.data, isRead: true } } as UnifiedNotification)),
      );
      setCount(0);
    } catch {
      // Non-fatal
    } finally {
      setMarkingAll(false);
    }
  }

  const hasUnread = count > 0;

  return (
    <div ref={containerRef} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        className={`relative rounded-lg p-2 transition-all ${
          isOpen
            ? "bg-purple-50 text-purple-600"
            : "text-gray-500 hover:bg-purple-50 hover:text-purple-600"
        }`}
        aria-label={`Notifications${hasUnread ? ` (${count} unread)` : ""}`}
      >
        <Bell className="h-4 w-4" />
        {hasUnread && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white ring-2 ring-white">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl shadow-black/10"
          style={{ maxHeight: "28rem" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-900">Notifications</span>
              {hasUnread && (
                <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">
                  {count} unread
                </span>
              )}
            </div>
            {count > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={markingAll}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-purple-600 transition-colors hover:bg-purple-50 disabled:opacity-50"
              >
                {markingAll ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3 w-3" />}
                Mark all read
              </button>
            )}
          </div>

          {/* Content */}
          <div className="overflow-y-auto" style={{ maxHeight: "22rem" }}>
            {listLoading && !hasFetched ? (
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
            ) : notifications.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((n) => (
                  <NotificationItem
                    key={unifiedId(n)}
                    notification={n}
                    onRead={handleMarkRead}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-gray-100 px-4 py-2.5 text-center">
              <p className="text-[11px] text-gray-400">
                Showing {notifications.length} most recent
                {listLoading && <Loader2 className="ml-1.5 inline-block h-3 w-3 animate-spin text-gray-400" />}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
