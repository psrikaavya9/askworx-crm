import { NextRequest, NextResponse } from "next/server";
import * as leadService from "@/modules/crm/services/lead.service";
import { serializePrisma } from "@/lib/serialize";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const assignedTo = searchParams.get("assignedTo") ?? undefined;
    const type = searchParams.get("type"); // "overdue" | "upcoming"

    if (type === "overdue") {
      const data = await leadService.getOverdueReminders(assignedTo);
      return NextResponse.json(serializePrisma(data));
    }

    if (type === "upcoming" && assignedTo) {
      const hours = Number(searchParams.get("withinHours") ?? 24);
      const data = await leadService.getUpcomingReminders(assignedTo, hours);
      return NextResponse.json(serializePrisma(data));
    }

    return NextResponse.json({ error: "Specify type=overdue or type=upcoming&assignedTo=..." }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
