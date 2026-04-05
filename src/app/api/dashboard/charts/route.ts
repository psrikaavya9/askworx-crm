import { NextResponse } from "next/server";
import { getChartData } from "@/modules/dashboard/services/chart.service";
import { serializePrisma } from "@/lib/serialize";

export async function GET() {
  try {
    const data = await getChartData();
    return NextResponse.json(serializePrisma(data));
  } catch (err) {
    console.error("[dashboard/charts]", err);
    return NextResponse.json(
      { error: "Failed to load chart data" },
      { status: 500 }
    );
  }
}
