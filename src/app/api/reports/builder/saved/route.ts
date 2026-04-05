import { NextResponse } from "next/server";
import { getSavedReports } from "@/modules/reports/services/builder.service";
import { serializePrisma } from "@/lib/serialize";

export async function GET() {
  try {
    const reports = await getSavedReports();
    return NextResponse.json(serializePrisma(reports));
  } catch (err) {
    console.error("[builder/saved]", err);
    return NextResponse.json({ error: "Failed to fetch saved reports" }, { status: 500 });
  }
}
