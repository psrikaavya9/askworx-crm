import { NextResponse } from "next/server";
import { getFinanceAlerts } from "@/modules/finance/services/finance-alerts.service";

export async function GET() {
  try {
    const alerts = await getFinanceAlerts();
    return NextResponse.json(alerts);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
