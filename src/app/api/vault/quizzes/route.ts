import { NextRequest, NextResponse } from "next/server";
import { z }                        from "zod/v4";
import { createVideoQuiz }          from "@/modules/quiz/services/quiz.service";

const QuestionSchema = z.object({
  question:    z.string().min(5),
  options:     z.array(z.string().min(1)).length(4),
  correctIdx:  z.number().int().min(0).max(3),
  explanation: z.string().optional(),
  order:       z.number().int().optional(),
});

const CreateQuizSchema = z.object({
  videoId:   z.string().uuid(),
  passMark:  z.number().int().min(50).max(100).optional(),
  questions: z.array(QuestionSchema).min(1).max(10),
});

export async function POST(req: NextRequest) {
  try {
    const body  = await req.json();
    const input = CreateQuizSchema.parse(body);
    const quiz  = await createVideoQuiz(input);
    return NextResponse.json({ success: true, quiz }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: err.issues }, { status: 400 });
    }
    const msg = err instanceof Error ? err.message : "Failed to create quiz";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
