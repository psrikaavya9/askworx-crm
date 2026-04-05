import { NextResponse } from "next/server";
import * as stockService from "@/modules/inventory/services/stock.service";
import { serializePrisma } from "@/lib/serialize";

export async function GET() {
  try {
    const kpi = await stockService.getInventoryKPI();
    return NextResponse.json(serializePrisma(kpi));
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
