import { queryRows, query } from "../db/pool";

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
  expiringSoon: DocumentAlertSummary[];  // low:    31–90 days
  critical:     DocumentAlertSummary[];  // medium: 8–30d  +  high: ≤7d
  expired:      DocumentAlertSummary[];  // status = EXPIRED
  counts: {
    expiringSoon: number;
    critical:     number;
    expired:      number;
  };
}

// ---------------------------------------------------------------------------
// Schema migration — idempotent
// ---------------------------------------------------------------------------

export async function ensureExpiryColumn(): Promise<void> {
  await query(`
    ALTER TABLE "HrDocument"
    ADD COLUMN IF NOT EXISTS "warningLevel" TEXT NOT NULL DEFAULT 'none'
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_hrdoc_warning_level
    ON "HrDocument"("warningLevel")
  `);
  console.log("[vault-server] ✓ warningLevel column ensured");
}

// ---------------------------------------------------------------------------
// Core expiry job
// ---------------------------------------------------------------------------

/**
 * Runs daily (and once on startup):
 * 1. Auto-expire ACTIVE documents whose expiresAt < NOW()
 * 2. Recalculate warningLevel for all remaining ACTIVE documents
 */
export async function runExpiryJob(): Promise<{
  expiredCount: number;
  updatedCount: number;
}> {
  // Step 1 — auto-expire
  const expiredRows = await queryRows<{ id: string }>(`
    UPDATE "HrDocument"
    SET    status       = 'EXPIRED',
           "warningLevel" = 'none',
           "updatedAt"  = NOW()
    WHERE  "isDeleted"  = false
      AND  status       = 'ACTIVE'
      AND  "expiresAt"  IS NOT NULL
      AND  "expiresAt"  < NOW()
    RETURNING id
  `);

  // Step 2 — recalculate warningLevel for ACTIVE docs
  const updatedRows = await queryRows<{ id: string }>(`
    UPDATE "HrDocument"
    SET    "warningLevel" = CASE
             WHEN "expiresAt" IS NULL                           THEN 'none'
             WHEN "expiresAt" - NOW() <= INTERVAL '7 days'     THEN 'high'
             WHEN "expiresAt" - NOW() <= INTERVAL '30 days'    THEN 'medium'
             WHEN "expiresAt" - NOW() <= INTERVAL '90 days'    THEN 'low'
             ELSE 'none'
           END,
           "updatedAt" = NOW()
    WHERE  "isDeleted" = false
      AND  status      = 'ACTIVE'
    RETURNING id
  `);

  const expiredCount = expiredRows.length;
  const updatedCount = updatedRows.length;

  console.log(
    `[expiry-job] ✓ Expired: ${expiredCount} | Warning levels updated: ${updatedCount}`
  );

  return { expiredCount, updatedCount };
}

// ---------------------------------------------------------------------------
// Alerts query
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
      WHERE  "isDeleted" = false
        AND  status      = 'ACTIVE'
        AND  "warningLevel" = 'low'
      ORDER BY "expiresAt" ASC
      LIMIT  20
    `),

    // Critical — medium (8–30d) + high (≤7d)
    queryRows<DocumentAlertSummary>(`
      SELECT id, title, "expiresAt", "warningLevel", category,
             GREATEST(0, CEIL(
               EXTRACT(EPOCH FROM ("expiresAt" - NOW())) / 86400
             ))::INTEGER AS "daysUntil"
      FROM   "HrDocument"
      WHERE  "isDeleted" = false
        AND  status      = 'ACTIVE'
        AND  "warningLevel" IN ('medium', 'high')
      ORDER BY "expiresAt" ASC
      LIMIT  20
    `),

    // Expired
    queryRows<DocumentAlertSummary>(`
      SELECT id, title, "expiresAt", "warningLevel", category,
             CEIL(
               EXTRACT(EPOCH FROM ("expiresAt" - NOW())) / 86400
             )::INTEGER AS "daysUntil"
      FROM   "HrDocument"
      WHERE  "isDeleted" = false
        AND  status      = 'EXPIRED'
        AND  "expiresAt" IS NOT NULL
      ORDER BY "expiresAt" DESC
      LIMIT  20
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
