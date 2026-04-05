import { NextRequest, NextResponse } from "next/server";
import { getLatestAttempt }          from "@/modules/quiz/services/quiz.service";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const attempt = await getLatestAttempt(id);
    return NextResponse.json({ success: true, attempt });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to fetch result" },
      { status: 500 }
    );
  }
}
