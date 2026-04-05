import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/authMiddleware";
import { hasRole } from "@/lib/middleware/roleCheck";
import * as expenseService from "@/modules/finance/services/expense.service";
import { serializePrisma } from "@/lib/serialize";
import { logAudit } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

const REJECTABLE = new Set(["PENDING_ACCOUNTS", "PENDING_OWNER"]);

export const PATCH = withAuth(async (req: NextRequest, user, ctx?: Ctx) => {
  const { id } = await ctx!.params;

  const body = await req.json().catch(() => ({})) as { rejectionReason?: string };
  const reason = body.rejectionReason?.trim();

  if (!reason) {
    return NextResponse.json(
      { success: false, error: "Rejection reason is required" },
      { status: 400 },
    );
  }

  const expense = await expenseService.getExpenseById(id);

  if (!REJECTABLE.has(expense.status)) {
    return NextResponse.json(
      { success: false, error: `Cannot reject an expense with status "${expense.status}"` },
      { status: 400 },
    );
  }

  // Role gate — ADMIN+ for accounts queue, OWNER for owner queue
  if (expense.status === "PENDING_ACCOUNTS" && !hasRole(user.role, "ADMIN")) {
    return NextResponse.json(
      { success: false, error: "Only Accounts team (Admin+) can reject accounts-queue expenses", code: "FORBIDDEN" },
      { status: 403 },
    );
  }
  if (expense.status === "PENDING_OWNER" && !hasRole(user.role, "OWNER")) {
    return NextResponse.json(
      { success: false, error: "Only the Owner can reject owner-queue expenses", code: "FORBIDDEN" },
      { status: 403 },
    );
  }

  const updated = await expenseService.rejectExpense(id, user.sub, reason);

  logAudit(user.sub, "EXPENSE_REJECTED", "expense", id, {
    previousStatus: expense.status,
    rejectionReason: reason,
    amount: Number(expense.amount),
  });

  return NextResponse.json({ success: true, expense: serializePrisma(updated) });
});
