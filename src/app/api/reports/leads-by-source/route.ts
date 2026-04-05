import { NextRequest, NextResponse } from "next/server";
import { getLeadsBySourceReport } from "@/modules/reports/services/report.service";
import { reportFiltersSchema } from "@/modules/reports/schemas/report.schema";
import { serializePrisma } from "@/lib/serialize";

export async function GET(req: NextRequest) {
  try {
    const filters = reportFiltersSchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    const result = await getLeadsBySourceReport(filters);
    return NextResponse.json(serializePrisma(result));
  } catch (err) {
    console.error("[reports/leads-by-source]", err);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
