import { prisma }          from "@/lib/prisma";
import type { CreateQuizInput } from "../types";

// ---------------------------------------------------------------------------
// Quiz CRUD
// ---------------------------------------------------------------------------

export async function findQuizByVideoId(videoId: string) {
  return prisma.videoQuiz.findUnique({
    where:   { videoId },
    include: {
      questions: {
        orderBy: { order: "asc" },
      },
    },
  });
}

export async function createQuiz(input: CreateQuizInput) {
  return prisma.videoQuiz.create({
    data: {
      videoId:  input.videoId,
      passMark: input.passMark ?? 70,
      questions: {
        create: input.questions.map((q, i) => ({
          question:    q.question,
          options:     q.options,
          correctIdx:  q.correctIdx,
          explanation: q.explanation ?? null,
          order:       q.order ?? i,
        })),
      },
    },
    include: { questions: { orderBy: { order: "asc" } } },
  });
}

export async function updateQuiz(
  quizId: string,
  data: { passMark?: number; isActive?: boolean }
) {
  return prisma.videoQuiz.update({ where: { id: quizId }, data });
}

// ---------------------------------------------------------------------------
// Attempts
// ---------------------------------------------------------------------------

export async function findLatestAttempt(videoId: string, staffId: string) {
  return prisma.videoQuizAttempt.findFirst({
    where:   { videoId, staffId },
    orderBy: { attemptedAt: "desc" },
  });
}

export async function findAllAttempts(videoId: string, staffId: string) {
  return prisma.videoQuizAttempt.findMany({
    where:   { videoId, staffId },
    orderBy: { attemptedAt: "desc" },
  });
}

export async function createAttempt(data: {
  quizId:  string;
  videoId: string;
  staffId: string;
  answers: Record<string, number>;
  score:   number;
  passed:  boolean;
}) {
  return prisma.videoQuizAttempt.create({ data });
}

// Rate-limit helper: check if last attempt was < 60 s ago (anti-spam)
export async function wasAttemptedRecently(videoId: string, staffId: string): Promise<boolean> {
  const recent = await prisma.videoQuizAttempt.findFirst({
    where:   { videoId, staffId },
    orderBy: { attemptedAt: "desc" },
    select:  { attemptedAt: true },
  });
  if (!recent) return false;
  const diffSecs = (Date.now() - recent.attemptedAt.getTime()) / 1000;
  return diffSecs < 60; // 60 s cooldown between attempts
}
