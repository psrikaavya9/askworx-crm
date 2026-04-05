import { query, queryRows, queryOne } from "@/lib/vault-db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotificationType = "DOCUMENT_REMINDER";

export interface VaultNotification {
  id:         string;
  userId:     string;
  documentId: string | null;
  type:       NotificationType;
  message:    string;
  isRead:     boolean;
  createdAt:  Date;
}

export interface NotificationListResult {
  rows:  VaultNotification[];
  total: number;
}

// ---------------------------------------------------------------------------
// List notifications for a user
// ---------------------------------------------------------------------------

export async function listNotificationsForUser(
  userId:  string,
  options?: { unreadOnly?: boolean; page?: number; limit?: number }
): Promise<NotificationListResult> {
  const page   = Math.max(1, options?.page  ?? 1);
  const limit  = Math.min(100, Math.max(1, options?.limit ?? 20));
  const offset = (page - 1) * limit;

  const conditions = [`"userId" = $1`];
  const params: unknown[] = [userId];
  let   p = 2;

  if (options?.unreadOnly) conditions.push(`"isRead" = false`);

  const where = conditions.join(" AND ");

  const countRow = await queryOne<{ total: string }>(
    `SELECT COUNT(*) AS total FROM "Notification" WHERE ${where}`,
    params
  );
  const total = parseInt(countRow?.total ?? "0", 10);

  params.push(limit, offset);
  const rows = await queryRows<VaultNotification>(
    `SELECT * FROM "Notification"
     WHERE ${where}
     ORDER BY "createdAt" DESC
     LIMIT $${p} OFFSET $${p + 1}`,
    params
  );

  return { rows, total };
}

// ---------------------------------------------------------------------------
// Unread count
// ---------------------------------------------------------------------------

export async function getUnreadCount(userId: string): Promise<number> {
  const row = await queryOne<{ count: string }>(
    `SELECT COUNT(*) AS count FROM "Notification"
     WHERE "userId" = $1 AND "isRead" = false`,
    [userId]
  );
  return parseInt(row?.count ?? "0", 10);
}

// ---------------------------------------------------------------------------
// Mark single notification read
// ---------------------------------------------------------------------------

export async function markNotificationRead(
  notificationId: string,
  userId:         string
): Promise<boolean> {
  const result = await query(
    `UPDATE "Notification"
     SET "isRead" = true
     WHERE id = $1 AND "userId" = $2 AND "isRead" = false`,
    [notificationId, userId]
  );
  return (result.rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Mark all notifications read
// ---------------------------------------------------------------------------

export async function markAllNotificationsRead(userId: string): Promise<number> {
  const result = await query(
    `UPDATE "Notification"
     SET "isRead" = true
     WHERE "userId" = $1 AND "isRead" = false`,
    [userId]
  );
  return result.rowCount ?? 0;
}

// ---------------------------------------------------------------------------
// Create document reminder notifications (daily job)
// ---------------------------------------------------------------------------

export async function createDocumentReminderNotifications(): Promise<number> {
  const result = await query<{ id: string }>(`
    INSERT INTO "Notification" ("userId", "documentId", type, message)
    SELECT
      s.id,
      d.id,
      'DOCUMENT_REMINDER',
      'Reminder: You have not yet acknowledged "' || d.title || '". '
        || 'Please review and acknowledge this document at your earliest convenience.'
    FROM  "HrDocument" d
    JOIN  "Staff"      s ON s.status = 'ACTIVE'
    WHERE d."requiresAck" = true
      AND d.status        = 'ACTIVE'
      AND d."isDeleted"   = false
      AND d."isLatest"    = true
      AND d."createdAt"  <= NOW() - INTERVAL '3 days'
      AND (
            d."accessLevel" = 'ALL'
        OR (d."accessLevel" = 'MANAGER_ONLY' AND s.role IN ('MANAGER', 'ADMIN'))
        OR (d."accessLevel" = 'HR_ONLY'      AND s.role = 'ADMIN')
        OR (d."accessLevel" = 'CUSTOM'       AND (
              s.id   = ANY(d."allowedStaff")
           OR s.role = ANY(d."allowedRoles")
           ))
      )
      AND NOT EXISTS (
        SELECT 1 FROM "DocAcknowledgement" a
        WHERE a."documentId" = d.id AND a."staffId" = s.id AND a."isDeleted" = false
      )
      AND NOT EXISTS (
        SELECT 1 FROM "Notification" n
        WHERE n."userId" = s.id AND n."documentId" = d.id
          AND n.type = 'DOCUMENT_REMINDER'
          AND n."createdAt" > NOW() - INTERVAL '24 hours'
      )
    RETURNING id
  `);

  return result.rowCount ?? 0;
}
