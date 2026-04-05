import { prisma } from "@/lib/prisma";
import { getClientProfitSummary } from "./expense.service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AlertSeverity = "high" | "medium" | "low";
export type AlertType = "loss" | "expense_growth" | "low_margin";

export interface FinanceAlert {
  type: AlertType;
  message: string;
  severity: AlertSeverity;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function monthBounds(offsetMonths: number): { gte: Date; lte: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1);
  const end   = new Date(now.getFullYear(), now.getMonth() + offsetMonths + 1, 0, 23, 59, 59, 999);
  return { gte: start, lte: end };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export async function getFinanceAlerts(): Promise<FinanceAlert[]> {
  const thisMonth = monthBounds(0);
  const lastMonth = monthBounds(-1);

  const [clientSummaries, thisMonthAgg, lastMonthAgg] = await Promise.all([
    getClientProfitSummary(),
    prisma.expense.aggregate({
      where: { status: "APPROVED", date: thisMonth },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: { status: "APPROVED", date: lastMonth },
      _sum: { amount: true },
    }),
  ]);

  const alerts: FinanceAlert[] = [];

  // Rule 1 — Loss-making clients (profit < 0)
  for (const client of clientSummaries) {
    if (client.profit < 0) {
      alerts.push({
        type: "loss",
        message: `${client.clientName} (${client.company}) is loss-making — profit ₹${client.profit.toLocaleString("en-IN")}`,
        severity: "high",
      });
    }
  }

  // Rule 2 — High expense growth (this month vs last month > 20%)
  const thisTotal = Number(thisMonthAgg._sum.amount ?? 0);
  const lastTotal = Number(lastMonthAgg._sum.amount ?? 0);

  if (lastTotal > 0) {
    const growthPct = ((thisTotal - lastTotal) / lastTotal) * 100;
    if (growthPct > 20) {
      alerts.push({
        type: "expense_growth",
        message: `Expenses increased by ${growthPct.toFixed(1)}% this month (₹${thisTotal.toLocaleString("en-IN")} vs ₹${lastTotal.toLocaleString("en-IN")} last month)`,
        severity: "medium",
      });
    }
  } else if (thisTotal > 0) {
    // Last month had zero approved expenses — any spend this month is flagged
    alerts.push({
      type: "expense_growth",
      message: `Expenses of ₹${thisTotal.toLocaleString("en-IN")} this month with no comparable prior-month baseline`,
      severity: "medium",
    });
  }

  // Rule 3 — Low profit margin (profit / revenue < 0.2), skip zero-revenue clients
  for (const client of clientSummaries) {
    if (client.revenue > 0 && client.profit / client.revenue < 0.2) {
      const marginPct = ((client.profit / client.revenue) * 100).toFixed(1);
      alerts.push({
        type: "low_margin",
        message: `${client.clientName} (${client.company}) has a low profit margin of ${marginPct}%`,
        severity: "medium",
      });
    }
  }

  return alerts;
}
