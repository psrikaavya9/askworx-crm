import { queryRows, query } from "@/lib/vault-db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WarningLevel = "none" | "low" | "medium" | "high";

export interface DocumentAlertSummary {
  id:           string;
  title:        string;
  expiresAt:    string;
  warningLevel: WarningLevel;
  category:     string;
  daysUntil:    number;
}

export interface AlertsResult {
  expiringSoon: DocumentAlertSummary[];
  critical:     DocumentAlertSummary[];
  expired:      DocumentAlertSummary[];
  counts: {
    expiringSoon: number;
    critical:     number;
    expired:      number;
  };
}

// ---------------------------------------------------------------------------
// Core expiry job
// Runs daily: auto-expire documents + recalculate warningLevel
// ---------------------------------------------------------------------------

export async function runExpiryJob(): Promise<{
  expiredCount: number;
  updatedCount: number;
}> {
  // Step 1 — auto-expire ACTIVE docs past their expiry date
  const expiredRows = await queryRows<{ id: string }>(`
    UPDATE "HrDocument"
    SET    status         = 'EXPIRED',
           "warningLevel" = 'none',
           "updatedAt"   = NOW()
    WHERE  "isDeleted" = false
      AND  status      = 'ACTIVE'
      AND  "expiresAt" IS NOT NULL
      AND  "expiresAt" < NOW()
    RETURNING id
  `);

  // Step 2 — recalculate warningLevel for remaining ACTIVE docs
  const updatedRows = await queryRows<{ id: string }>(`
    UPDATE "HrDocument"
    SET    "warningLevel" = CASE
             WHEN "expiresAt" IS NULL                         THEN 'none'
             WHEN "expiresAt" - NOW() <= INTERVAL '7 days'   THEN 'high'
             WHEN "expiresAt" - NOW() <= INTERVAL '30 days'  THEN 'medium'
             WHEN "expiresAt" - NOW() <= INTERVAL '90 days'  THEN 'low'
             ELSE 'none'
           END,
           "updatedAt" = NOW()
    WHERE  "isDeleted" = false AND status = 'ACTIVE'
    RETURNING id
  `);

  return { expiredCount: expiredRows.length, updatedCount: updatedRows.length };
}

// ---------------------------------------------------------------------------
// Alerts query — expiring-soon, critical, expired documents
// ---------------------------------------------------------------------------

export async function getDocumentAlerts(): Promise<AlertsResult> {
  const [expiringSoon, critical, expired] = await Promise.all([
    // Low priority — 31–90 days
    queryRows<DocumentAlertSummary>(`
      SELECT id, title, "expiresAt", "warningLevel", category,
             GREATEST(0, CEIL(
               EXTRACT(EPOCH FROM ("expiresAt" - NOW())) / 86400
             ))::INTEGER AS "daysUntil"
      FROM   "HrDocument"
      WHERE  "isDeleted" = false AND status = 'ACTIVE' AND "warningLevel" = 'low'
      ORDER BY "expiresAt" ASC LIMIT 20
    `),

    // Critical — medium (8–30d) + high (≤7d)
    queryRows<DocumentAlertSummary>(`
      SELECT id, title, "expiresAt", "warningLevel", category,
             GREATEST(0, CEIL(
               EXTRACT(EPOCH FROM ("expiresAt" - NOW())) / 86400
             ))::INTEGER AS "daysUntil"
      FROM   "HrDocument"
      WHERE  "isDeleted" = false AND status = 'ACTIVE' AND "warningLevel" IN ('medium', 'high')
      ORDER BY "expiresAt" ASC LIMIT 20
    `),

    // Expired
    queryRows<DocumentAlertSummary>(`
      SELECT id, title, "expiresAt", "warningLevel", category,
             CEIL(
               EXTRACT(EPOCH FROM ("expiresAt" - NOW())) / 86400
             )::INTEGER AS "daysUntil"
      FROM   "HrDocument"
      WHERE  "isDeleted" = false AND status = 'EXPIRED' AND "expiresAt" IS NOT NULL
      ORDER BY "expiresAt" DESC LIMIT 20
    `),
  ]);

  return {
    expiringSoon,
    critical,
    expired,
    counts: {
      expiringSoon: expiringSoon.length,
      critical:     critical.length,
      expired:      expired.length,
    },
  };
}
