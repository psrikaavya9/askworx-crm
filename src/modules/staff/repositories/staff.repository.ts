import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { CreateStaffInput, UpdateStaffInput, StaffFiltersInput } from "../schemas/staff.schema";
import type { PaginatedResult } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildWhereClause(filters: Partial<StaffFiltersInput>): Prisma.StaffWhereInput {
  const where: Prisma.StaffWhereInput = {};

  if (filters.status) where.status = filters.status;
  if (filters.role) where.role = filters.role;
  if (filters.department) where.department = { contains: filters.department, mode: "insensitive" };

  if (filters.search) {
    const s = filters.search.trim();
    where.OR = [
      { firstName: { contains: s, mode: "insensitive" } },
      { lastName: { contains: s, mode: "insensitive" } },
      { email: { contains: s, mode: "insensitive" } },
      { department: { contains: s, mode: "insensitive" } },
    ];
  }

  return where;
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function findStaff(
  filters: StaffFiltersInput
): Promise<PaginatedResult<Awaited<ReturnType<typeof prisma.staff.findMany>>[number]>> {
  const { page, pageSize, sortBy, sortOrder } = filters;
  const where = buildWhereClause(filters);
  const skip = (page - 1) * pageSize;

  const data = await prisma.staff.findMany({
    where,
    orderBy: { [sortBy]: sortOrder },
    skip,
    take: pageSize,
  });
  const total = await prisma.staff.count({ where });

  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function findStaffById(id: string) {
  return prisma.staff.findUnique({ where: { id } });
}

export async function findStaffByEmail(email: string) {
  return prisma.staff.findUnique({ where: { email } });
}

export async function findAllActiveStaff() {
  return prisma.staff.findMany({
    where: { status: "ACTIVE" },
    orderBy: { firstName: "asc" },
  });
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

export async function createStaff(data: CreateStaffInput) {
  return prisma.staff.create({ data });
}

export async function updateStaff(id: string, data: UpdateStaffInput) {
  return prisma.staff.update({
    where: { id },
    data: {
      ...(data.firstName !== undefined && { firstName: data.firstName }),
      ...(data.lastName !== undefined && { lastName: data.lastName }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.role !== undefined && { role: data.role }),
      ...(data.department !== undefined && { department: data.department }),
      ...(data.status !== undefined && { status: data.status }),
    },
  });
}

export async function deleteStaff(id: string) {
  return prisma.staff.delete({ where: { id } });
}

export async function countActiveStaff() {
  return prisma.staff.count({ where: { status: "ACTIVE" } });
}
