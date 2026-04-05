import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRole } from "@/lib/middleware/roleCheck";

// ---------------------------------------------------------------------------
// GET /api/expenses/budget  (minimum role: ADMIN)
//
// For every configured category budget, returns:
//   category    — the expense category name
//   limit       — the configured monthly ceiling (₹)
//   used        — sum of approved expenses in the current calendar month
//   remaining   — limit - used (can be negative if over-budget)
//   percent     — (used / limit) * 100, rounded
//   alert       — true when percent >= 80
// ---------------------------------------------------------------------------

export const GET = withRole("ADMIN", async () => {
  const now   = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // Two parallel queries — budgets + actual spend this month
  const [budgets, actuals] = await Promise.all([
    prisma.expenseCategoryBudget.findMany({
      orderBy: { category: "asc" },
    }),
    prisma.expense.groupBy({
      by: ["category"],
      where: {
        status: "APPROVED",
        date:   { gte: start, lte: end },
      },
      _sum: { amount: true },
    }),
  ]);

  // O(1) lookup map: category → approved spend this month
  const spendMap = new Map(
    actuals.map((r) => [r.category, Number(r._sum.amount ?? 0)])
  );

  const data = budgets.map((b) => {
    const limit     = Number(b.monthlyLimit);
    const used      = spendMap.get(b.category) ?? 0;
    const percent   = limit > 0 ? Math.round((used / limit) * 100) : 0;
    const remaining = limit - used;

    return {
      category:  b.category,
      limit,
      used,
      remaining,
      percent,
      alert:     percent >= 80,
    };
  });

  return NextResponse.json(data);
});
