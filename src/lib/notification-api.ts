"use client";

/**
 * notification-api.ts
 *
 * Focused entry-point for the notification UI layer.
 * Delegates to the vault-api functions — no duplicate fetch logic.
 */

export {
  listNotifications,
  getNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "./vault-api";

export type { VaultNotification, ListNotificationsParams } from "./vault-api";

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

/**
 * Returns a human-readable relative time string ("2m ago", "3h ago", etc.)
 * Falls back to a locale date string for anything older than 7 days.
 */
export function timeAgo(iso: string): string {
  const diffMs  = Date.now() - new Date(iso).getTime();
  const diffSec = Math.floor(diffMs / 1_000);

  if (diffSec <  60)  return "just now";
  if (diffSec <  3_600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec <  86_400) return `${Math.floor(diffSec / 3_600)}h ago`;
  if (diffSec <  604_800) return `${Math.floor(diffSec / 86_400)}d ago`;

  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short",
  });
}
