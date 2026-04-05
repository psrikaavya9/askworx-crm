import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/dev/seed/interactions
 *
 * Inserts 5 test CustomerInteraction records (mix of CALL and VISIT).
 * All records are pending review (approved=false, rejected=false).
 *
 * Idempotent — skips records that already exist for the same client+staff+date.
 * Dev only — returns 403 in production.
 */

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  // Resolve the first available client and staff IDs at runtime so the seed
  // works on any database, not just the one with hardcoded IDs.
  const [clients, staff] = await Promise.all([
    prisma.client.findMany({ select: { id: true, firstName: true, lastName: true }, take: 2 }),
    prisma.staff.findMany({  select: { id: true, firstName: true, lastName: true }, take: 3 }),
  ]);

  if (clients.length < 2) {
    return NextResponse.json(
      { error: "Need at least 2 clients — run POST /api/dev/seed/crm first" },
      { status: 422 },
    );
  }
  if (staff.length < 2) {
    return NextResponse.json(
      { error: "Need at least 2 staff members — run POST /api/dev/seed/staff first" },
      { status: 422 },
    );
  }

  const now      = new Date();
  const daysAgo  = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
  const daysFrom = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);

  const RECORDS = [
    {
      clientId:    clients[0].id,
      staffId:     staff[0].id,
      type:        "CALL"  as const,
      date:        daysAgo(1),
      duration:    18,
      outcome:     "Demo scheduled for next week",
      notes:       "Client expressed strong interest in the enterprise plan. Follow-up call booked for Thursday.",
      approved:    false,
      rejected:    false,
    },
    {
      clientId:    clients[0].id,
      staffId:     staff[1].id,
      type:        "VISIT" as const,
      date:        daysAgo(3),
      duration:    45,
      outcome:     "Site survey completed",
      notes:       "Visited Bangalore office. Met with the IT head. Requirements documented and sent to the product team.",
      gpsLat:      12.9716,
      gpsLng:      77.5946,
      approved:    false,
      rejected:    false,
    },
    {
      clientId:    clients[1].id,
      staffId:     staff[staff.length - 1].id,
      type:        "CALL"  as const,
      date:        daysAgo(5),
      duration:    9,
      outcome:     "No answer — left voicemail",
      notes:       "Called twice. Left voicemail on second attempt. Will retry tomorrow morning.",
      approved:    false,
      rejected:    false,
    },
    {
      clientId:    clients[1].id,
      staffId:     staff[0].id,
      type:        "VISIT" as const,
      date:        daysAgo(7),
      duration:    60,
      outcome:     "Proposal presented",
      notes:       "Presented Q3 proposal. Positive reception. Client requested a revised pricing sheet by EOD Friday.",
      gpsLat:      19.0760,
      gpsLng:      72.8777,
      approved:    false,
      rejected:    false,
    },
    {
      clientId:    clients[0].id,
      staffId:     staff[staff.length - 1].id,
      type:        "CALL"  as const,
      date:        daysAgo(10),
      duration:    25,
      outcome:     "Follow-up scheduled",
      notes:       "Discussed renewal terms. Client comparing two vendors. Will send competitive comparison doc.",
      nextFollowUp: daysFrom(3),
      approved:    false,
      rejected:    false,
    },
  ];

  const created: string[] = [];
  const skipped: string[] = [];

  for (const record of RECORDS) {
    // Idempotency check — same client + staff + date (within same day)
    const startOfDay = new Date(record.date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(record.date);
    endOfDay.setHours(23, 59, 59, 999);

    const existing = await prisma.customerInteraction.findFirst({
      where: {
        clientId: record.clientId,
        staffId:  record.staffId,
        type:     record.type,
        date:     { gte: startOfDay, lte: endOfDay },
      },
      select: { id: true },
    });

    if (existing) {
      skipped.push(`${record.type} on ${record.date.toDateString()} (already exists)`);
    } else {
      await prisma.customerInteraction.create({ data: record });
      created.push(`${record.type} — "${record.outcome}"`);
    }
  }

  return NextResponse.json({
    message: "Interaction seed complete",
    created,
    skipped,
    note: "All new records have approved=false — visit /reviews to review them",
  });
}
