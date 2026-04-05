import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/authMiddleware";
import { hasRole } from "@/lib/middleware/roleCheck";
import * as expenseService from "@/modules/finance/services/expense.service";
import { serializePrisma } from "@/lib/serialize";
import { logAudit } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

const APPROVABLE = new Set(["PENDING_ACCOUNTS", "PENDING_OWNER"]);

export const PATCH = withAuth(async (req: NextRequest, user, ctx?: Ctx) => {
  const { id } = await ctx!.params;

  // Fetch expense first so we can check current status
  const expense = await expenseService.getExpenseById(id);

  if (!APPROVABLE.has(expense.status)) {
    return NextResponse.json(
      { success: false, error: `Cannot approve an expense with status "${expense.status}"` },
      { status: 400 },
    );
  }

  // Role gate — must match the queue the expense is currently in
  if (expense.status === "PENDING_ACCOUNTS" && !hasRole(user.role, "ADMIN")) {
    return NextResponse.json(
      { success: false, error: "Only Accounts team (Admin+) can approve accounts-queue expenses", code: "FORBIDDEN" },
      { status: 403 },
    );
  }
  if (expense.status === "PENDING_OWNER" && !hasRole(user.role, "OWNER")) {
    return NextResponse.json(
      { success: false, error: "Only the Owner can approve owner-queue expenses", code: "FORBIDDEN" },
      { status: 403 },
    );
  }

  const updated = await expenseService.approveExpense(id, user.sub);

  logAudit(user.sub, "EXPENSE_APPROVED", "expense", id, {
    previousStatus: expense.status,
    amount: Number(expense.amount),
  });

  return NextResponse.json({ success: true, expense: serializePrisma(updated) });
});
