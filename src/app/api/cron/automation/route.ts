import { NextRequest, NextResponse } from "next/server";
import { runAutomationJob } from "@/modules/crm/services/automation.service";

/**
 * GET /api/cron/automation
 *
 * Secured cron endpoint — must include the Authorization header:
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Intended to run every hour via an external scheduler (Vercel Cron, cron-job.org, etc.).
 *
 * Rules executed:
 *   1. No interaction in 3 days   → create FOLLOW_UP reminder + optional email
 *   2. Stage unchanged > 7 days   → create stage-stuck reminder + timeline activity + optional email
 *
 * All rules are idempotent — safe to re-run within the same cooldown window.
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
    const result = await runAutomationJob();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/automation] Unhandled error:", err);
    return NextResponse.json({ error: "Job failed" }, { status: 500 });
  }
}
