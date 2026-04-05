"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, FileText, CheckCheck, Loader2, BellOff } from "lucide-react";
import {
  listNotifications,
  getNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  timeAgo,
} from "@/lib/notification-api";
import type { VaultNotification } from "@/lib/notification-api";

// How often to poll for the unread count (ms). 60 s is light enough for production.
const POLL_INTERVAL_MS = 60_000;

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
      <p className="text-xs text-gray-400">You're all caught up!</p>
    </div>
  );
}

function NotificationItem({
  notification,
  onRead,
}: {
  notification: VaultNotification;
  onRead: (id: string) => void;
}) {
  const isUnread = !notification.isRead;

  function handleClick() {
    if (isUnread) onRead(notification.id);
  }

  return (
    <button
      onClick={handleClick}
      className={`group w-full text-left transition-colors ${
        isUnread ? "bg-purple-50/60 hover:bg-purple-50" : "hover:bg-gray-50"
      }`}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Icon */}
        <div
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            isUnread
              ? "bg-purple-100 text-purple-600"
              : "bg-gray-100 text-gray-400"
          }`}
        >
          <FileText className="h-4 w-4" />
        </div>

        {/* Body */}
        <div className="min-w-0 flex-1">
          <p
            className={`text-xs leading-relaxed ${
              isUnread ? "font-medium text-gray-800" : "text-gray-500"
            }`}
          >
            {notification.message}
          </p>
          <p className="mt-1 text-[10px] text-gray-400">
            {timeAgo(notification.createdAt)}
          </p>
        </div>

        {/* Unread dot */}
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
  const [isOpen,         setIsOpen]         = useState(false);
  const [count,          setCount]          = useState(0);
  const [notifications,  setNotifications]  = useState<VaultNotification[]>([]);
  const [listLoading,    setListLoading]    = useState(false);
  const [markingAll,     setMarkingAll]     = useState(false);
  const [hasFetched,     setHasFetched]     = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // ── Fetch unread count ────────────────────────────────────────────────────

  const refreshCount = useCallback(async () => {
    try {
      const res = await getNotificationCount();
      setCount(res.data.unreadCount);
    } catch {
      // Vault server offline — silently ignore, show no badge
    }
  }, []);

  // Poll count on mount + every POLL_INTERVAL_MS
  useEffect(() => {
    refreshCount();
    const id = setInterval(refreshCount, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refreshCount]);

  // ── Fetch list when dropdown opens ───────────────────────────────────────

  const fetchNotifications = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await listNotifications({ limit: 30 });
      setNotifications(res.data);
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

  function handleMarkRead(id: string) {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    setCount((c) => Math.max(0, c - 1));

    markNotificationRead(id).catch(() => {
      // Revert optimistic update on failure
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: false } : n))
      );
      setCount((c) => c + 1);
    });
  }

  // ── Mark all as read ─────────────────────────────────────────────────────

  async function handleMarkAllRead() {
    if (markingAll || count === 0) return;
    setMarkingAll(true);
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setCount(0);
    } catch {
      // Non-fatal — user can retry
    } finally {
      setMarkingAll(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const hasUnread = count > 0;

  return (
    <div ref={containerRef} className="relative">
      {/* ── Bell button ── */}
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

        {/* Unread badge */}
        {hasUnread && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white ring-2 ring-white">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {/* ── Dropdown panel ── */}
      {isOpen && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl shadow-black/10"
          style={{ maxHeight: "28rem" }}
        >
          {/* Header row */}
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-900">Notifications</span>
              {hasUnread && (
                <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">
                  {count} unread
                </span>
              )}
            </div>

            {/* Mark all read */}
            {count > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={markingAll}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-purple-600 transition-colors hover:bg-purple-50 disabled:opacity-50"
              >
                {markingAll ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <CheckCheck className="h-3 w-3" />
                )}
                Mark all read
              </button>
            )}
          </div>

          {/* Content */}
          <div className="overflow-y-auto" style={{ maxHeight: "22rem" }}>
            {listLoading && !hasFetched ? (
              // Initial loading skeleton
              <div className="space-y-0">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3">
                    <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-gray-100" />
                    <div className="flex-1 space-y-2 pt-0.5">
                      <div className="h-2.5 w-5/6 animate-pulse rounded-full bg-gray-100" />
                      <div className="h-2 w-3/6 animate-pulse rounded-full bg-gray-100" />
                      <div className="h-2 w-2/6 animate-pulse rounded-full bg-gray-50" />
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
                    key={n.id}
                    notification={n}
                    onRead={handleMarkRead}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer — only show when there are items */}
          {notifications.length > 0 && (
            <div className="border-t border-gray-100 px-4 py-2.5 text-center">
              <p className="text-[11px] text-gray-400">
                Showing {notifications.length} most recent
                {listLoading && (
                  <Loader2 className="ml-1.5 inline-block h-3 w-3 animate-spin text-gray-400" />
                )}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
