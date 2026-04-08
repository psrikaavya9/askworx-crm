/**
 * POST /api/crm/reminders/auto-generate
 *
 * Scans all active leads (non-WON / non-LOST) whose lastActivityAt
 * is older than 3 days and creates a FOLLOW_UP reminder for each one
 * that doesn't already have an active pending reminder.
 *
 * Safe to call repeatedly — duplicate check prevents double-creation.
 *
 * Response: { created: number; skipped: number }
 */
import { NextResponse } from "next/server";
import { autoGenerateFollowUpReminders } from "@/modules/crm/services/lead.service";

export async function POST() {
  try {
    const result = await autoGenerateFollowUpReminders();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("[auto-generate reminders]", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
