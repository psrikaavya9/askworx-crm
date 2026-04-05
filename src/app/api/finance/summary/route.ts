import { NextResponse } from "next/server";
import { getFinanceSummary } from "@/modules/finance/services/expense.service";

export async function GET() {
  try {
    const summary = await getFinanceSummary();
    return NextResponse.json(summary);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
