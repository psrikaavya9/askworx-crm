import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { CreateProjectInput, UpdateProjectInput, ProjectFiltersInput } from "../schemas/project.schema";
import type { PaginatedResult } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildWhereClause(filters: Partial<ProjectFiltersInput>): Prisma.ProjectWhereInput {
  const where: Prisma.ProjectWhereInput = {};

  if (filters.status) where.status = filters.status;
  if (filters.clientId) where.clientId = filters.clientId;

  if (filters.overdue) {
    where.deadline = { lt: new Date() };
    where.status = { notIn: ["COMPLETED"] };
  }

  if (filters.search) {
    const search = filters.search.trim();
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  return where;
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function findProjects(
  filters: ProjectFiltersInput
): Promise<PaginatedResult<Awaited<ReturnType<typeof findProjectSummary>>>> {
  const { page, pageSize, sortBy, sortOrder } = filters;
  const where = buildWhereClause(filters);
  const skip = (page - 1) * pageSize;

  const data = await prisma.project.findMany({
    where,
    orderBy: { [sortBy]: sortOrder },
    skip,
    take: pageSize,
    include: {
      client: {
        select: { id: true, firstName: true, lastName: true, company: true },
      },
      tasks: { select: { hoursLogged: true } },
      _count: { select: { tasks: true } },
    },
  });
  const total = await prisma.project.count({ where });

  return {
    data: data as never,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function findProjectById(id: string) {
  return prisma.project.findUnique({
    where: { id },
    include: {
      client: true,
      tasks: {
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { timeLogs: true } } },
      },
    },
  });
}

async function findProjectSummary(id: string) {
  return prisma.project.findUnique({
    where: { id },
    include: {
      client: {
        select: { id: true, firstName: true, lastName: true, company: true },
      },
      _count: { select: { tasks: true } },
    },
  });
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

export async function createProject(data: CreateProjectInput) {
  return prisma.project.create({
    data: {
      name: data.name,
      description: data.description,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      deadline: data.deadline ? new Date(data.deadline) : undefined,
      status: data.status,
      clientId: data.clientId,
    },
    include: {
      client: {
        select: { id: true, firstName: true, lastName: true, company: true },
      },
    },
  });
}

export async function updateProject(id: string, data: UpdateProjectInput) {
  return prisma.project.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.startDate !== undefined && {
        startDate: data.startDate ? new Date(data.startDate) : null,
      }),
      ...(data.deadline !== undefined && {
        deadline: data.deadline ? new Date(data.deadline) : null,
      }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.clientId !== undefined && { clientId: data.clientId }),
    },
  });
}

export async function deleteProject(id: string) {
  return prisma.project.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// KPI helpers
// ---------------------------------------------------------------------------

export async function countProjectsByStatus() {
  return prisma.project.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
}

export async function countOverdueProjects() {
  return prisma.project.count({
    where: {
      deadline: { lt: new Date() },
      status: { notIn: ["COMPLETED"] },
    },
  });
}
