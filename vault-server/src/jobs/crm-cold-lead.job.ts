/**
 * CRM Cold-Lead Job
 *
 * Calls the main Next.js app's secured cron endpoint to trigger cold-lead
 * detection + overdue-reminder sweep. Kept in the vault-server so that the
 * main app doesn't need its own scheduler (no extra dependencies).
 */

const CRM_BASE_URL  = process.env.CRM_APP_URL  ?? "http://localhost:3000";
const CRON_SECRET   = process.env.CRON_SECRET   ?? "";

export async function runCrmColdLeadJob(): Promise<void> {
  console.log("[crm-cold-lead] Triggering CRM cold-lead detection…");

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (CRON_SECRET) headers["Authorization"] = `Bearer ${CRON_SECRET}`;

  const res = await fetch(`${CRM_BASE_URL}/api/cron/cold-leads`, { headers });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`CRM cron endpoint responded ${res.status}: ${body}`);
  }

  const data = await res.json() as Record<string, unknown>;
  console.log("[crm-cold-lead] Done:", data);
}
