import { prisma } from "@/lib/prisma";
import type { Prisma, ExpenseStatus } from "@/generated/prisma/client";
import type { CreateExpenseInput, ExpenseFiltersInput } from "../schemas/expense.schema";
import type { PaginatedResult } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const expenseInclude = {
  staff: { select: { id: true, firstName: true, lastName: true, email: true } },
} satisfies Prisma.ExpenseInclude;

function buildWhere(filters: Partial<ExpenseFiltersInput>): Prisma.ExpenseWhereInput {
  const where: Prisma.ExpenseWhereInput = {};

  if (filters.status) where.status = filters.status;
  if (filters.staffId) where.staffId = filters.staffId;
  if (filters.category) where.category = { contains: filters.category, mode: "insensitive" };

  if (filters.search) {
    const s = filters.search.trim();
    where.OR = [
      { description: { contains: s, mode: "insensitive" } },
      { category: { contains: s, mode: "insensitive" } },
    ];
  }

  return where;
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function findExpenses(
  filters: ExpenseFiltersInput
): Promise<PaginatedResult<Awaited<ReturnType<typeof prisma.expense.findFirst>>>> {
  const { page, pageSize, sortBy, sortOrder } = filters;
  const where = buildWhere(filters);
  const skip = (page - 1) * pageSize;

  const data = await prisma.expense.findMany({
    where,
    include: expenseInclude,
    orderBy: { [sortBy]: sortOrder },
    skip,
    take: pageSize,
  });
  const total = await prisma.expense.count({ where });

  return {
    data: data as never,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function findExpenseById(id: string) {
  return prisma.expense.findUnique({ where: { id }, include: expenseInclude });
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

// Validation-derived fields are computed server-side and are NOT part of the Zod schema.
// We extend the input type here so the repository stays the single write point.
type CreateExpenseData = CreateExpenseInput & {
  status?:    ExpenseStatus;
  isFlagged?: boolean;
  flagReason?: string;
};

export async function createExpense(data: CreateExpenseData) {
  return prisma.expense.create({
    data: {
      staffId:     data.staffId,
      category:    data.category,
      amount:      data.amount,
      description: data.description,
      receiptUrl:  data.receiptUrl || null,
      date:        data.date,
      // Module 10 fields
      paymentMode: data.paymentMode,
      gpsLat:      data.gpsLat,
      gpsLng:      data.gpsLng,
      clientId:    data.clientId,
      projectId:   data.projectId,
      // Layer 2–4 — server-computed fields (never from client)
      status:      data.status,
      isFlagged:   data.isFlagged  ?? false,
      flagReason:  data.flagReason ?? null,
    },
    include: expenseInclude,
  });
}

export async function findMyExpenses(staffId: string) {
  return prisma.expense.findMany({
    where:   { staffId },
    orderBy: { createdAt: "desc" },
    take:    100,
    include: expenseInclude,
  });
}

export async function updateExpenseStatus(id: string, status: ExpenseStatus) {
  return prisma.expense.update({ where: { id }, data: { status }, include: expenseInclude });
}

export async function approveExpenseById(id: string, approvedBy: string) {
  return prisma.expense.update({
    where: { id },
    data: { status: "APPROVED", approvedBy, approvedAt: new Date() },
    include: expenseInclude,
  });
}

export async function rejectExpenseById(
  id: string,
  rejectedBy: string,
  rejectionReason: string,
) {
  return prisma.expense.update({
    where: { id },
    data: { status: "REJECTED", rejectedBy, rejectedAt: new Date(), rejectionReason },
    include: expenseInclude,
  });
}

export async function reimburseExpenseById(id: string, reimbursedBy: string) {
  return prisma.expense.update({
    where:   { id },
    data:    { status: "REIMBURSED", reimbursedBy, reimbursedAt: new Date() },
    include: expenseInclude,
  });
}

export async function getPendingCounts() {
  const [pendingAccounts, pendingOwner] = await Promise.all([
    prisma.expense.count({ where: { status: "PENDING_ACCOUNTS" } }),
    prisma.expense.count({ where: { status: "PENDING_OWNER" } }),
  ]);
  return { pendingAccounts, pendingOwner };
}

// ---------------------------------------------------------------------------
// KPI helpers
// ---------------------------------------------------------------------------

export async function getExpenseKpiData() {
  const total = await prisma.expense.aggregate({
    where: { status: "APPROVED" },
    _sum: { amount: true },
  });
  const pending = await prisma.expense.count({
    where: { status: { in: ["PENDING", "PENDING_ACCOUNTS", "PENDING_OWNER"] } },
  });

  return { total, pending };
}

export async function getExpenseGroupedByClient() {
  return prisma.expense.groupBy({
    by: ["clientId"],
    where: { status: "APPROVED", clientId: { not: null } },
    _sum: { amount: true },
  });
}
