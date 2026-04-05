import { NextRequest, NextResponse } from "next/server";
import { findUserReminders } from "@/modules/crm/repositories/reminder.repository";
import { serializePrisma } from "@/lib/serialize";

/**
 * GET /api/crm/reminders/my?userId=<id>
 * Returns reminders grouped into: overdue, dueToday, upcoming.
 * Used by the reminders page and the bell dropdown.
 */
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId") ?? "admin";
    const data = await findUserReminders(userId);
    return NextResponse.json(serializePrisma(data));
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
