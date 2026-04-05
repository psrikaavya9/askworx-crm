import { NextRequest, NextResponse } from "next/server";
import { runColdLeadJob } from "@/modules/crm/services/cold-lead.service";

/**
 * GET /api/cron/cold-leads
 *
 * Secured cron endpoint — must include the Authorization header:
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Called daily at 09:00 by the vault-server cron or an external scheduler.
 *
 * Tasks:
 *   1. Mark PENDING reminders with dueAt < now → OVERDUE
 *   2. Detect leads with no activity > 7 days → isCold = true + COLD_ALERT reminder
 *   3. Recover leads that resumed activity → isCold = false + dismiss COLD_ALERTs
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (secret) {
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (token !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await runColdLeadJob();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/cold-leads] Error:", err);
    return NextResponse.json({ error: "Job failed" }, { status: 500 });
  }
}
