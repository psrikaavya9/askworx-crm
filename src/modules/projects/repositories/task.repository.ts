import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { CreateTaskInput, UpdateTaskInput, TaskFiltersInput } from "../schemas/task.schema";
import type { PaginatedResult } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildWhereClause(
  projectId: string | undefined,
  filters: Partial<TaskFiltersInput>
): Prisma.TaskWhereInput {
  const where: Prisma.TaskWhereInput = {};

  if (projectId) where.projectId = projectId;
  if (filters.projectId) where.projectId = filters.projectId;
  if (filters.status) where.status = filters.status;
  if (filters.priority) where.priority = filters.priority;

  if (filters.assignedStaff) {
    where.assignedStaff = { has: filters.assignedStaff };
  }

  if (filters.overdue) {
    where.dueDate = { lt: new Date() };
    where.status = { not: "DONE" };
  }

  if (filters.search) {
    const search = filters.search.trim();
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  return where;
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function findTasks(
  filters: TaskFiltersInput,
  projectId?: string
): Promise<PaginatedResult<Awaited<ReturnType<typeof findTaskById>> extends null ? never : NonNullable<Awaited<ReturnType<typeof findTaskById>>>>> {
  const { page, pageSize, sortBy, sortOrder } = filters;
  const where = buildWhereClause(projectId, filters);
  const skip = (page - 1) * pageSize;

  const data = await prisma.task.findMany({
    where,
    orderBy: { [sortBy]: sortOrder },
    skip,
    take: pageSize,
    include: {
      project: { select: { id: true, name: true } },
      _count: { select: { timeLogs: true } },
    },
  });
  const total = await prisma.task.count({ where });

  return {
    data: data as never,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function findTaskById(id: string) {
  return prisma.task.findUnique({
    where: { id },
    include: {
      project: { select: { id: true, name: true, status: true } },
      timeLogs: { orderBy: { loggedAt: "desc" } },
    },
  });
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

export async function createTask(projectId: string, data: CreateTaskInput) {
  return prisma.task.create({
    data: {
      projectId,
      title: data.title,
      description: data.description,
      assignedStaff: data.assignedStaff ?? [],
      status: data.status,
      priority: data.priority,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
    },
    include: {
      project: { select: { id: true, name: true, status: true } },
    },
  });
}

export async function updateTask(id: string, data: UpdateTaskInput) {
  return prisma.task.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.assignedStaff !== undefined && { assignedStaff: data.assignedStaff }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.priority !== undefined && { priority: data.priority }),
      ...(data.dueDate !== undefined && {
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
      }),
    },
  });
}

export async function deleteTask(id: string) {
  return prisma.task.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// Hours aggregation
// ---------------------------------------------------------------------------

export async function recalcTaskHours(taskId: string): Promise<void> {
  const agg = await prisma.timeLog.aggregate({
    where: { taskId },
    _sum: { hours: true },
  });
  const total = agg._sum.hours ?? 0;
  await prisma.task.update({ where: { id: taskId }, data: { hoursLogged: total } });
}

// ---------------------------------------------------------------------------
// KPI helpers
// ---------------------------------------------------------------------------

export async function countTasksByStatus(projectId?: string) {
  return prisma.task.groupBy({
    by: ["status"],
    where: projectId ? { projectId } : undefined,
    _count: { _all: true },
  });
}

export async function countOverdueTasks(projectId?: string) {
  return prisma.task.count({
    where: {
      ...(projectId && { projectId }),
      dueDate: { lt: new Date() },
      status: { not: "DONE" },
    },
  });
}

export async function sumHoursLogged(projectId?: string) {
  const result = await prisma.task.aggregate({
    where: projectId ? { projectId } : undefined,
    _sum: { hoursLogged: true },
  });
  return Number(result._sum.hoursLogged ?? 0);
}
