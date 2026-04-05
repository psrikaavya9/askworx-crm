import { prisma } from "@/lib/prisma";
import type { CreateTimeLogInput, UpdateTimeLogInput } from "../schemas/task.schema";

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function findTimeLogsByTask(taskId: string) {
  return prisma.timeLog.findMany({
    where: { taskId },
    orderBy: { loggedAt: "desc" },
  });
}

export async function findTimeLogById(id: string) {
  return prisma.timeLog.findUnique({ where: { id } });
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

export async function createTimeLog(taskId: string, data: CreateTimeLogInput) {
  return prisma.timeLog.create({
    data: {
      taskId,
      hours: data.hours,
      note: data.note,
      loggedAt: data.loggedAt ? new Date(data.loggedAt) : new Date(),
    },
  });
}

export async function updateTimeLog(id: string, data: UpdateTimeLogInput) {
  return prisma.timeLog.update({
    where: { id },
    data: {
      ...(data.hours !== undefined && { hours: data.hours }),
      ...(data.note !== undefined && { note: data.note }),
      ...(data.loggedAt !== undefined && { loggedAt: new Date(data.loggedAt) }),
    },
  });
}

export async function deleteTimeLog(id: string) {
  return prisma.timeLog.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// Aggregation helpers
// ---------------------------------------------------------------------------

export async function sumHoursByTask(taskId: string): Promise<number> {
  const result = await prisma.timeLog.aggregate({
    where: { taskId },
    _sum: { hours: true },
  });
  return Number(result._sum.hours ?? 0);
}
