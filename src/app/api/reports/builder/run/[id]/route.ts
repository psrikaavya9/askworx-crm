import { NextRequest, NextResponse } from "next/server";
import { runSavedReport, deleteSavedReport } from "@/modules/reports/services/builder.service";
import { serializePrisma } from "@/lib/serialize";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await runSavedReport(id);
    return NextResponse.json(serializePrisma(result));
  } catch (err) {
    console.error("[builder/run]", err);
    return NextResponse.json({ error: "Failed to run report" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteSavedReport(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[builder/run DELETE]", err);
    return NextResponse.json({ error: "Failed to delete report" }, { status: 500 });
  }
}
