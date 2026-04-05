import { NextResponse } from "next/server";
import { getFinanceKPI } from "@/modules/finance/services/expense.service";
import { serializePrisma } from "@/lib/serialize";

export async function GET() {
  try {
    const kpi = await getFinanceKPI();
    return NextResponse.json(serializePrisma(kpi));
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
