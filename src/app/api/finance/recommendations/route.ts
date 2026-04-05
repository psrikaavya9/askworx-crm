import { NextResponse } from "next/server";
import { getFinanceRecommendations } from "@/modules/finance/services/finance-recommendations.service";

export async function GET() {
  try {
    const recommendations = await getFinanceRecommendations();
    return NextResponse.json(recommendations);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
