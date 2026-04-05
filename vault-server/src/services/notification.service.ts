import { query, queryRows, queryOne } from "../db/pool";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotificationType = "DOCUMENT_REMINDER";

export interface Notification {
  id:          string;
  userId:      string;
  documentId:  string | null;
  type:        NotificationType;
  message:     string;
  isRead:      boolean;
  createdAt:   Date;
}

export interface NotificationListResult {
  rows:  Notification[];
  total: number;
}

// ---------------------------------------------------------------------------
// Schema migration — idempotent, called once at startup
// ---------------------------------------------------------------------------

export async function ensureNotificationTable(): Promise<void> {
  // gen_random_uuid() is built-in from PostgreSQL 13+.
  // For older installations, load pgcrypto so the function is available.
  // This is a no-op on PG 13+ and safe to run every time.
  await query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

  // "documentId" is stored as plain TEXT with no foreign-key constraint.
  // A FK would require knowing the exact column type of HrDocument.id (UUID vs TEXT),
  // which cannot be safely assumed across different PostgreSQL setups.
  // Referential integrity is enforced at the application layer instead.
  await query(`
    CREATE TABLE IF NOT EXISTS "Notification" (
      id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId"      TEXT         NOT NULL,
      "documentId"  TEXT,
      type          TEXT         NOT NULL DEFAULT 'DOCUMENT_REMINDER',
      message       TEXT         NOT NULL,
      "isRead"      BOOLEAN      NOT NULL DEFAULT false,
      "createdAt"   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);

  // Indexes for common access patterns
  await query(`
    CREATE INDEX IF NOT EXISTS idx_notification_user_id
    ON "Notification"("userId")
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_notification_doc_id
    ON "Notification"("documentId")
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_notification_user_unread
    ON "Notification"("userId", "isRead")
    WHERE "isRead" = false
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_notification_created_at
    ON "Notification"("createdAt" DESC)
  `);

  console.log("[vault-server] ✓ Notification table ensured");
}

// ---------------------------------------------------------------------------
// Core reminder job
// ---------------------------------------------------------------------------

/**
 * Finds every (staff, document) pair where:
 *   - Document: requiresAck=true, status=ACTIVE, createdAt >= 3 days ago
 *   - Staff:    has access to the document AND has not yet acknowledged it
 *   - Guard:    no DOCUMENT_REMINDER was sent for the same pair in the last 24 h
 *
 * Inserts a Notification row for every qualifying pair in a single
 * INSERT … SELECT statement (atomic, no N+1 loops).
 *
 * Returns the number of new notifications created.
 */
export async function createDocumentReminderNotifications(): Promise<number> {
  //
  // Single INSERT … SELECT covers all four access-level variants:
  //   ALL           → every active staff member
  //   MANAGER_ONLY  → staff whose role is MANAGER or ADMIN
  //   HR_ONLY       → staff whose role is ADMIN
  //   CUSTOM        → staff whose id is in allowedStaff[] OR whose role is in allowedRoles[]
  //
  // The WHERE clause simultaneously:
  //   1. Excludes staff who already acknowledged the document
  //   2. Excludes staff who received a reminder for the same doc within the last 24 h
  //
  const result = await query<{ id: string }>(`
    INSERT INTO "Notification" ("userId", "documentId", type, message)
    SELECT
      s.id          AS "userId",
      d.id          AS "documentId",
      'DOCUMENT_REMINDER',
      'Reminder: You have not yet acknowledged "' || d.title || '". '
        || 'Please review and acknowledge this document at your earliest convenience.'
    FROM  "HrDocument" d
    JOIN  "Staff"      s ON s.status = 'ACTIVE'
    WHERE d."requiresAck" = true
      AND d.status        = 'ACTIVE'
      AND d."isDeleted"   = false
      AND d."isLatest"    = true
      -- Only documents at least 3 days old (give staff time to notice)
      AND d."createdAt"  <= NOW() - INTERVAL '3 days'
      -- Access-level gate: only notify staff who can actually see this doc
      AND (
            d."accessLevel" = 'ALL'
        OR (d."accessLevel" = 'MANAGER_ONLY' AND s.role IN ('MANAGER', 'ADMIN'))
        OR (d."accessLevel" = 'HR_ONLY'      AND s.role = 'ADMIN')
        OR (d."accessLevel" = 'CUSTOM'       AND (
              s.id   = ANY(d."allowedStaff")
           OR s.role = ANY(d."allowedRoles")
           ))
      )
      -- Not yet acknowledged
      AND NOT EXISTS (
        SELECT 1
        FROM   "DocAcknowledgement" a
        WHERE  a."documentId" = d.id
          AND  a."staffId"    = s.id
          AND  a."isDeleted"  = false
      )
      -- Duplicate-guard: no reminder for this (user, document) pair in last 24 h
      AND NOT EXISTS (
        SELECT 1
        FROM   "Notification" n
        WHERE  n."userId"     = s.id
          AND  n."documentId" = d.id
          AND  n.type         = 'DOCUMENT_REMINDER'
          AND  n."createdAt"  > NOW() - INTERVAL '24 hours'
      )
    RETURNING id
  `);

  return result.rowCount ?? 0;
}

// ---------------------------------------------------------------------------
// Read helpers (used by the notifications API)
// ---------------------------------------------------------------------------

/**
 * Lists notifications for a given user, newest first.
 * Optionally filters to unread only.
 */
export async function listNotificationsForUser(
  userId:   string,
  options?: { unreadOnly?: boolean; page?: number; limit?: number }
): Promise<NotificationListResult> {
  const page   = Math.max(1, options?.page  ?? 1);
  const limit  = Math.min(100, Math.max(1, options?.limit ?? 20));
  const offset = (page - 1) * limit;

  const conditions = [`"userId" = $1`];
  const params: unknown[] = [userId];
  let   p = 2;

  if (options?.unreadOnly) {
    conditions.push(`"isRead" = false`);
  }

  const where = conditions.join(" AND ");

  const countRow = await queryOne<{ total: string }>(
    `SELECT COUNT(*) AS total FROM "Notification" WHERE ${where}`,
    params
  );
  const total = parseInt(countRow?.total ?? "0", 10);

  params.push(limit, offset);
  const rows = await queryRows<Notification>(
    `SELECT * FROM "Notification"
     WHERE  ${where}
     ORDER  BY "createdAt" DESC
     LIMIT  $${p} OFFSET $${p + 1}`,
    params
  );

  return { rows, total };
}

/**
 * Returns the count of unread notifications for a user.
 * Cheap query — used for the bell-badge count.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const row = await queryOne<{ count: string }>(
    `SELECT COUNT(*) AS count FROM "Notification"
     WHERE  "userId" = $1 AND "isRead" = false`,
    [userId]
  );
  return parseInt(row?.count ?? "0", 10);
}

/**
 * Marks a single notification as read.
 * Only the owning user can mark their own notifications.
 * Returns true if the row was found and updated.
 */
export async function markNotificationRead(
  notificationId: string,
  userId:         string
): Promise<boolean> {
  const result = await query(
    `UPDATE "Notification"
     SET    "isRead" = true
     WHERE  id = $1 AND "userId" = $2 AND "isRead" = false`,
    [notificationId, userId]
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Marks all unread notifications for a user as read.
 * Returns the number of rows updated.
 */
export async function markAllNotificationsRead(userId: string): Promise<number> {
  const result = await query(
    `UPDATE "Notification"
     SET    "isRead" = true
     WHERE  "userId" = $1 AND "isRead" = false`,
    [userId]
  );
  return result.rowCount ?? 0;
}
