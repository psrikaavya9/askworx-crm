import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/middleware/roleCheck";
import * as expenseService from "@/modules/finance/services/expense.service";
import { serializePrisma } from "@/lib/serialize";
import { logAudit } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// PATCH /api/expenses/:id/reimburse  (minimum role: ADMIN)
//
// Transitions an APPROVED expense to REIMBURSED and stamps who processed it.
//
// Guards:
//   1. Expense must exist                      → 404
//   2. Current status must be APPROVED         → 400
// ---------------------------------------------------------------------------

export const PATCH = withRole("ADMIN", async (_req: NextRequest, user, ctx?: Ctx) => {
  const { id } = await ctx!.params;

  const expense = await expenseService.getExpenseById(id);

  if (expense.status !== "APPROVED") {
    return NextResponse.json(
      {
        success: false,
        error:   `Only APPROVED expenses can be reimbursed. Current status: "${expense.status}"`,
      },
      { status: 400 },
    );
  }

  const updated = await expenseService.reimburseExpense(id, user.sub);

  logAudit(user.sub, "EXPENSE_REIMBURSED", "expense", id, {
    amount:   Number(expense.amount),
    category: expense.category,
    staffId:  expense.staffId,
  });

  return NextResponse.json({ success: true, expense: serializePrisma(updated) });
});
