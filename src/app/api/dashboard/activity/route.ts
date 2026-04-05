import { NextResponse } from "next/server";
import { getRecentActivity } from "@/modules/dashboard/services/chart.service";
import { serializePrisma } from "@/lib/serialize";

export async function GET() {
  try {
    const data = await getRecentActivity();
    return NextResponse.json(serializePrisma(data));
  } catch (err) {
    console.error("[dashboard/activity]", err);
    return NextResponse.json(
      { error: "Failed to load recent activity" },
      { status: 500 }
    );
  }
}
