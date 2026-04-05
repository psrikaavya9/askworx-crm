import { NextResponse } from "next/server";
import { getAllKPIs } from "@/modules/dashboard/services/dashboard.service";
import { serializePrisma } from "@/lib/serialize";

export async function GET() {
  try {
    const kpis = await getAllKPIs();
    return NextResponse.json(serializePrisma(kpis));
  } catch (err) {
    console.error("[dashboard/kpis]", err);
    return NextResponse.json(
      { error: "Failed to load dashboard KPIs" },
      { status: 500 }
    );
  }
}
