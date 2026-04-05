import { Response } from "express";
import { AuthRequest } from "../types";
import {
  listNotificationsForUser,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "../services/notification.service";
import {
  sendSuccess,
  sendError,
  sendPaginated,
} from "../utils/response.util";

// ---------------------------------------------------------------------------
// GET /api/v1/notifications
//
// Query params:
//   unread   = "true"  → only unread notifications
//   page     = number  → default 1
//   limit    = number  → default 20, max 100
// ---------------------------------------------------------------------------

export async function listNotifications(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const userId     = req.user!.sub;
    const unreadOnly = req.query.unread === "true";
    const page       = Math.max(1, parseInt(String(req.query.page  ?? "1"),  10) || 1);
    const limit      = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));

    const { rows, total } = await listNotificationsForUser(userId, {
      unreadOnly,
      page,
      limit,
    });

    sendPaginated(res, rows, total, page, limit);
  } catch (err) {
    console.error("[notifications] listNotifications error:", err);
    sendError(res, "Failed to fetch notifications", 500);
  }
}

// ---------------------------------------------------------------------------
// GET /api/v1/notifications/count
//
// Returns { unreadCount: number } — lightweight endpoint for bell-badge.
// ---------------------------------------------------------------------------

export async function getNotificationCount(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const count = await getUnreadCount(req.user!.sub);
    sendSuccess(res, { unreadCount: count });
  } catch (err) {
    console.error("[notifications] getNotificationCount error:", err);
    sendError(res, "Failed to fetch notification count", 500);
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/v1/notifications/:id/read
//
// Marks a single notification as read.
// Only the owning user can do this (enforced in service).
// ---------------------------------------------------------------------------

export async function markRead(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { id }  = req.params;
    const userId  = req.user!.sub;

    if (!id) {
      sendError(res, "Notification ID is required", 400);
      return;
    }

    const updated = await markNotificationRead(id, userId);

    if (!updated) {
      // Either doesn't exist, belongs to another user, or already read — all treated the same
      sendError(res, "Notification not found or already read", 404);
      return;
    }

    sendSuccess(res, { id, isRead: true });
  } catch (err) {
    console.error("[notifications] markRead error:", err);
    sendError(res, "Failed to mark notification as read", 500);
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/v1/notifications/read-all
//
// Marks ALL unread notifications for the authenticated user as read.
// Must be registered BEFORE /:id/read so "read-all" isn't parsed as an ID.
// ---------------------------------------------------------------------------

export async function markAllRead(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const updated = await markAllNotificationsRead(req.user!.sub);
    sendSuccess(res, { markedRead: updated });
  } catch (err) {
    console.error("[notifications] markAllRead error:", err);
    sendError(res, "Failed to mark notifications as read", 500);
  }
}
