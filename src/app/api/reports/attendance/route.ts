import { NextRequest, NextResponse } from "next/server";
import { getAttendanceReport } from "@/modules/reports/services/report.service";
import { reportFiltersSchema } from "@/modules/reports/schemas/report.schema";
import { serializePrisma } from "@/lib/serialize";

export async function GET(req: NextRequest) {
  try {
    const filters = reportFiltersSchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    const result = await getAttendanceReport(filters);
    return NextResponse.json(serializePrisma(result));
  } catch (err) {
    console.error("[reports/attendance]", err);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
