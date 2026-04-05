import { NextRequest, NextResponse } from "next/server";
import { getQuizForVideo }          from "@/modules/quiz/services/quiz.service";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result  = await getQuizForVideo(id);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to fetch quiz" },
      { status: 500 }
    );
  }
}
