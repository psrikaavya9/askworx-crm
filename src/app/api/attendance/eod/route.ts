import { NextRequest, NextResponse } from "next/server";
import { runEndOfDayProcessing } from "@/modules/staff/services/attendance.service";

/**
 * POST /api/attendance/eod
 *
 * End-of-day batch — marks ABSENT for every active staff member
 * who has no check-in record today (after 12:00 UTC).
 *
 * Intended to be called by a scheduled job (cron) or manually by an admin.
 * Protected by a simple CRON_SECRET header check.
 */
export async function POST(req: NextRequest) {
  // Simple secret check — prevents accidental or unauthenticated calls
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const provided = req.headers.get("x-cron-secret");
    if (provided !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await runEndOfDayProcessing();
    return NextResponse.json({
      success: true,
      message: result.marked > 0
        ? `Marked ${result.marked} staff member(s) as ABSENT.`
        : "No absent records to create — either too early or all staff checked in.",
      ...result,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
