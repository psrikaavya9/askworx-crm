import { NextResponse } from "next/server";
import { getClientProfitSummary } from "@/modules/finance/services/expense.service";

export async function GET() {
  try {
    const data = await getClientProfitSummary();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
