import { NextRequest, NextResponse } from "next/server";
import { countPendingReminders } from "@/modules/crm/repositories/reminder.repository";

/**
 * GET /api/crm/reminders/count?userId=<id>
 * Returns the count of actionable reminders (overdue + due in next 24 h).
 * Used by the CrmReminderBell to show the badge number.
 */
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId") ?? "admin";
    const count = await countPendingReminders(userId);
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
