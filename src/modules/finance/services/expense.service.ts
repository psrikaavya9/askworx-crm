import { prisma } from "@/lib/prisma";
import * as invoiceRepo from "../repositories/invoice.repository";
import * as expenseRepo from "../repositories/expense.repository";
import type { CreateExpenseInput, ExpenseFiltersInput } from "../schemas/expense.schema";
import type { ExpenseStatus } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Expense CRUD
// ---------------------------------------------------------------------------

export async function createExpense(
  data: CreateExpenseInput & { status?: ExpenseStatus; isFlagged?: boolean; flagReason?: string },
) {
  return expenseRepo.createExpense(data);
}

export async function getMyExpenses(staffId: string) {
  return expenseRepo.findMyExpenses(staffId);
}

export async function getExpenses(filters: ExpenseFiltersInput) {
  return expenseRepo.findExpenses(filters);
}

export async function getExpenseById(id: string) {
  const expense = await expenseRepo.findExpenseById(id);
  if (!expense) throw new Error(`Expense not found: ${id}`);
  return expense;
}

export async function approveExpense(id: string, approvedBy: string) {
  await getExpenseById(id);
  return expenseRepo.approveExpenseById(id, approvedBy);
}

export async function rejectExpense(id: string, rejectedBy: string, rejectionReason: string) {
  await getExpenseById(id);
  return expenseRepo.rejectExpenseById(id, rejectedBy, rejectionReason);
}

export async function reimburseExpense(id: string, reimbursedBy: string) {
  await getExpenseById(id);
  return expenseRepo.reimburseExpenseById(id, reimbursedBy);
}

export async function getPendingCounts() {
  return expenseRepo.getPendingCounts();
}

// ---------------------------------------------------------------------------
// Finance Summary
// ---------------------------------------------------------------------------

export async function getClientProfitSummary() {
  const [clients, revenueRows, expenseRows] = await Promise.all([
    prisma.client.findMany({
      select: { id: true, firstName: true, lastName: true, company: true },
    }),
    invoiceRepo.getRevenueGroupedByClient(),
    expenseRepo.getExpenseGroupedByClient(),
  ]);

  const revenueMap = new Map(
    revenueRows.map((r) => [r.clientId, Number(r._sum.totalAmount ?? 0)])
  );
  const expenseMap = new Map(
    expenseRows.map((r) => [r.clientId, Number(r._sum.amount ?? 0)])
  );

  return clients.map((c) => {
    const revenue = revenueMap.get(c.id) ?? 0;
    const expense = expenseMap.get(c.id) ?? 0;
    return {
      clientId: c.id,
      clientName: `${c.firstName} ${c.lastName}`,
      company: c.company,
      revenue,
      expense,
      profit: revenue - expense,
    };
  });
}

export async function getFinanceSummary() {
  const [revenueAgg, expenseAgg] = await Promise.all([
    prisma.invoice.aggregate({
      where: { status: { in: ["PAID", "SENT"] } },
      _sum: { totalAmount: true },
    }),
    prisma.expense.aggregate({
      where: { status: "APPROVED" },
      _sum: { amount: true },
    }),
  ]);

  const totalRevenue = Number(revenueAgg._sum.totalAmount ?? 0);
  const totalExpense = Number(expenseAgg._sum.amount ?? 0);
  const netProfit = totalRevenue - totalExpense;

  return { totalRevenue, totalExpense, netProfit };
}

// ---------------------------------------------------------------------------
// KPI
// ---------------------------------------------------------------------------

export async function getFinanceKPI() {
  const [invoiceKpi, expenseKpi] = await Promise.all([
    import("../repositories/invoice.repository").then((r) => r.getInvoiceKpiData()),
    expenseRepo.getExpenseKpiData(),
  ]);

  const totalRevenue = Number(invoiceKpi.paid._sum.totalAmount ?? 0);
  const outstandingInvoices = Number(invoiceKpi.outstanding._sum.totalAmount ?? 0);
  const totalExpenses = Number(expenseKpi.total._sum.amount ?? 0);
  const netProfit = totalRevenue - totalExpenses;

  return {
    totalRevenue,
    outstandingInvoices,
    totalExpenses,
    netProfit,
    totalInvoicesCount: invoiceKpi.total,
    paidInvoicesCount: invoiceKpi.paid._count,
    overdueInvoicesCount: invoiceKpi.overdue,
    pendingExpensesCount: expenseKpi.pending,
  };
}
