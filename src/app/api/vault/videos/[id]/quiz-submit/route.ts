import { NextRequest, NextResponse } from "next/server";
import { submitQuizAnswers }         from "@/modules/quiz/services/quiz.service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id }   = await params;
    const body     = await req.json() as { answers?: Record<string, number> };

    if (!body.answers || typeof body.answers !== "object") {
      return NextResponse.json(
        { success: false, error: "answers object is required" },
        { status: 400 }
      );
    }

    const result = await submitQuizAnswers(id, body.answers);
    return NextResponse.json({ success: true, result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Submission failed";
    const status = msg.includes("wait") ? 429 : msg.includes("No quiz") ? 404 : 500;
    return NextResponse.json({ success: false, error: msg }, { status });
  }
}
