import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/dev/seed/attendance
 * Seeds today's attendance records for all active staff, covering all
 * three statuses: PRESENT, LATE, and (implicitly) ABSENT.
 * Idempotent — skips records that already exist for the same staff+date.
 */
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  // Normalise to midnight UTC (matches toDateOnly() in the repository)
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const activeStaff = await prisma.staff.findMany({
    where: { status: "ACTIVE" },
    orderBy: { firstName: "asc" },
    select: { id: true, firstName: true, lastName: true },
  });

  if (activeStaff.length === 0) {
    return NextResponse.json({ error: "No active staff found. Seed staff first." }, { status: 422 });
  }

  // Build a time on TODAY at a given UTC hour:minute
  function todayAt(utcHour: number, utcMinute = 0): Date {
    const d = new Date(today);
    d.setUTCHours(utcHour, utcMinute, 0, 0);
    return d;
  }

  // Attendance plan — cover PRESENT, LATE, and leave one staff with no record (ABSENT)
  // We assign plans by position so the seed is deterministic regardless of staff names.
  const plans: Array<{
    checkInHour: number;
    checkInMinute: number;
    checkOut: boolean;
    checkOutHour?: number;
    status: "PRESENT" | "LATE";
  } | null> = [
    // Index 0 → PRESENT, with checkout
    { checkInHour: 8, checkInMinute: 15, checkOut: true,  checkOutHour: 17, status: "PRESENT" },
    // Index 1 → LATE, no checkout yet
    { checkInHour: 9, checkInMinute: 42, checkOut: false, status: "LATE" },
    // Index 2 → PRESENT, no checkout yet
    { checkInHour: 7, checkInMinute: 58, checkOut: false, status: "PRESENT" },
    // Index 3+ → null means ABSENT (no record inserted)
    null,
  ];

  const created: string[] = [];
  const skipped: string[] = [];
  const absent: string[] = [];

  for (let i = 0; i < activeStaff.length; i++) {
    const member = activeStaff[i];
    const plan = i < plans.length ? plans[i] : null;
    const name = `${member.firstName} ${member.lastName}`;

    if (!plan) {
      absent.push(name);
      continue;
    }

    // Check if a record already exists for today
    const existing = await prisma.attendance.findUnique({
      where: { staffId_date: { staffId: member.id, date: today } },
    });

    if (existing) {
      skipped.push(name);
      continue;
    }

    const checkInTime = todayAt(plan.checkInHour, plan.checkInMinute);
    const checkOutTime = plan.checkOut && plan.checkOutHour != null
      ? todayAt(plan.checkOutHour)
      : null;

    await prisma.attendance.create({
      data: {
        staffId: member.id,
        date: today,
        checkInTime,
        checkOutTime,
        attendanceStatus: plan.status,
        method: null,
      },
    });

    created.push(name);
  }

  return NextResponse.json({
    message: "Attendance seed complete",
    date: today.toISOString().slice(0, 10),
    created,
    skipped,
    absent,
  });
}
