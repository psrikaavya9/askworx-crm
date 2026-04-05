import { NextRequest, NextResponse } from "next/server";
import { getCRMDashboardKPI } from "@/modules/crm/services/kpi.service";
import { serializePrisma } from "@/lib/serialize";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const startDate = searchParams.get("from") ? new Date(searchParams.get("from")!) : undefined;
    const endDate = searchParams.get("to") ? new Date(searchParams.get("to")!) : undefined;
    const kpi = await getCRMDashboardKPI(startDate, endDate);
    return NextResponse.json(serializePrisma(kpi));
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
