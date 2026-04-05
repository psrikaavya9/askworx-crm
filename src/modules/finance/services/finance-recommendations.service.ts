import { prisma } from "@/lib/prisma";
import { getClientProfitSummary } from "./expense.service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RecommendationType = "cost" | "price" | "upsell";

export interface Recommendation {
  type: RecommendationType;
  message: string;
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

const fmt = (n: number) =>
  `₹${Math.abs(n).toLocaleString("en-IN")}`;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export async function getFinanceRecommendations(): Promise<Recommendation[]> {
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

  const recommendations: Recommendation[] = [];

  // Rule 1 — High expense growth (> 25%): suggest cost optimisation
  const thisTotal = Number(thisMonthAgg._sum.amount ?? 0);
  const lastTotal = Number(lastMonthAgg._sum.amount ?? 0);

  if (lastTotal > 0) {
    const growthPct = ((thisTotal - lastTotal) / lastTotal) * 100;
    if (growthPct > 25) {
      recommendations.push({
        type: "cost",
        message: `Expenses grew by ${growthPct.toFixed(1)}% this month (${fmt(thisTotal)} vs ${fmt(lastTotal)} last month). Review recurring costs and consider renegotiating vendor contracts.`,
      });
    }
  }

  // Rule 2 — Low profit margin per client (< 20%): suggest price revision
  // Skip clients with no revenue (margin undefined) and loss-making clients
  // (negative margin is covered separately; price revision applies to thin but positive margins)
  for (const client of clientSummaries) {
    if (client.revenue > 0 && client.profit >= 0) {
      const margin = client.profit / client.revenue;
      if (margin < 0.2) {
        const marginPct = (margin * 100).toFixed(1);
        recommendations.push({
          type: "price",
          message: `${client.clientName} (${client.company}) has a ${marginPct}% profit margin. Consider revising pricing or reducing service costs for this account.`,
        });
      }
    }
  }

  // Rule 3 — Top 3 profitable clients: suggest upsell / prioritisation
  const top3 = [...clientSummaries]
    .filter((c) => c.profit > 0)
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 3);

  for (const client of top3) {
    recommendations.push({
      type: "upsell",
      message: `${client.clientName} (${client.company}) generated ${fmt(client.profit)} in profit. Prioritise this account and explore upsell or expansion opportunities.`,
    });
  }

  return recommendations;
}
