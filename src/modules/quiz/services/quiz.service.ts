import {
  findQuizByVideoId,
  createQuiz,
  findLatestAttempt,
  createAttempt,
  wasAttemptedRecently,
} from "../repositories/quiz.repository";
import type { QuizSummary, QuizSubmitResult, CreateQuizInput } from "../types";

// ---------------------------------------------------------------------------
// Get quiz for a video (strips correct answers)
// ---------------------------------------------------------------------------

export async function getQuizForVideo(videoId: string): Promise<{
  quiz:    QuizSummary | null;
  attempt: { passed: boolean; score: number; attemptedAt: string } | null;
}> {
  const quiz = await findQuizByVideoId(videoId);
  if (!quiz || !quiz.isActive) return { quiz: null, attempt: null };

  const staffId = "staff-001"; // TODO: real auth
  const latest  = await findLatestAttempt(videoId, staffId);

  return {
    quiz: {
      id:       quiz.id,
      videoId:  quiz.videoId,
      passMark: quiz.passMark,
      questions: quiz.questions.map((q) => ({
        id:       q.id,
        question: q.question,
        options:  q.options as string[],
        order:    q.order,
        // correctIdx and explanation intentionally omitted
      })),
    },
    attempt: latest
      ? { passed: latest.passed, score: latest.score, attemptedAt: latest.attemptedAt.toISOString() }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Submit quiz answers → score → save attempt
// ---------------------------------------------------------------------------

export async function submitQuizAnswers(
  videoId: string,
  answers: Record<string, number>   // questionId → selectedIdx
): Promise<QuizSubmitResult> {
  const quiz = await findQuizByVideoId(videoId);
  if (!quiz)         throw new Error("No quiz found for this video");
  if (!quiz.isActive) throw new Error("Quiz is not active");

  const staffId = "staff-001"; // TODO: real auth

  // Anti-spam: 60 s cooldown
  if (await wasAttemptedRecently(videoId, staffId)) {
    throw new Error("Please wait 60 seconds before retrying the quiz.");
  }

  const questions = quiz.questions;
  let correctCount = 0;
  const review: QuizSubmitResult["review"] = [];

  for (const q of questions) {
    const selected  = answers[q.id] ?? -1;
    const isCorrect = selected === q.correctIdx;
    if (isCorrect) correctCount++;

    review.push({
      questionId:  q.id,
      question:    q.question,
      yourAnswer:  selected,
      correct:     q.correctIdx,
      isCorrect,
      explanation: q.explanation ?? undefined,
    });
  }

  const score  = questions.length > 0 ? (correctCount / questions.length) * 100 : 0;
  const passed = score >= quiz.passMark;

  const attempt = await createAttempt({
    quizId:  quiz.id,
    videoId,
    staffId,
    answers,
    score,
    passed,
  });

  return {
    score,
    passed,
    passMark:       quiz.passMark,
    attemptedAt:    attempt.attemptedAt.toISOString(),
    totalQuestions: questions.length,
    correctCount,
    review,
  };
}

// ---------------------------------------------------------------------------
// Get latest attempt result
// ---------------------------------------------------------------------------

export async function getLatestAttempt(videoId: string) {
  const staffId = "staff-001";
  const attempt = await findLatestAttempt(videoId, staffId);
  if (!attempt) return null;
  return {
    id:          attempt.id,
    score:       attempt.score,
    passed:      attempt.passed,
    attemptedAt: attempt.attemptedAt.toISOString(),
    answers:     attempt.answers as Record<string, number>,
  };
}

// ---------------------------------------------------------------------------
// Create quiz (admin)
// ---------------------------------------------------------------------------

export async function createVideoQuiz(input: CreateQuizInput) {
  const existing = await findQuizByVideoId(input.videoId);
  if (existing) throw new Error("A quiz already exists for this video.");
  if (!input.questions.length) throw new Error("Quiz must have at least 1 question.");
  return createQuiz(input);
}
