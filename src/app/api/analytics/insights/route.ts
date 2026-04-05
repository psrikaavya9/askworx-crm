import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export interface Insight {
  type: "warning" | "success" | "info";
  message: string;
}

const ACTIVE_STAGES = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL"] as const;

const SOURCE_LABELS: Record<string, string> = {
  WEBSITE: "Website",
  REFERRAL: "Referral",
  SOCIAL_MEDIA: "Social Media",
  EMAIL_CAMPAIGN: "Email Campaign",
  COLD_CALL: "Cold Call",
  TRADE_SHOW: "Trade Show",
  PARTNER: "Partner",
  OTHER: "Other",
};

const STAGE_LABELS: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  PROPOSAL: "Proposal",
};

export async function GET() {
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  // Run all data fetches in parallel
  const [lostLeads, allLeads, stageGroups, recentActivityLeadIds, activeLeadIds] =
    await Promise.all([
      // A: Loss reasons — all LOST leads with a reason
      prisma.lead.findMany({
        where: { stage: "LOST" },
        select: { lostReason: true },
      }),

      // B: Best source — all leads with source + stage for conversion calc
      prisma.lead.findMany({
        select: { source: true, stage: true },
      }),

      // C: Pipeline bottleneck — count per active stage
      prisma.lead.groupBy({
        by: ["stage"],
        where: { stage: { in: [...ACTIVE_STAGES] } },
        _count: { _all: true },
      }),

      // D: Activity warning — leads that have had any activity in the last 3 days
      prisma.leadActivity.findMany({
        where: {
          createdAt: { gte: threeDaysAgo },
          type: { in: ["CALL_MADE", "EMAIL_SENT", "NOTE_ADDED", "MEETING_HELD"] },
        },
        select: { leadId: true },
        distinct: ["leadId"],
      }),

      // D (cont): All leads currently in active stages
      prisma.lead.findMany({
        where: { stage: { in: [...ACTIVE_STAGES] } },
        select: { id: true },
      }),
    ]);

  const insights: Insight[] = [];

  // ── A: Loss Insight ────────────────────────────────────────────────────────
  if (lostLeads.length > 0) {
    const counts: Record<string, number> = {};
    for (const { lostReason } of lostLeads) {
      const key = lostReason?.trim() || "No reason given";
      counts[key] = (counts[key] ?? 0) + 1;
    }
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const pct = Math.round((top[1] / lostLeads.length) * 100);
    if (pct > 40) {
      insights.push({
        type: "warning",
        message: `Most deals lost due to "${top[0]}" (${pct}% of lost leads)`,
      });
    }
  }

  // ── B: Best Source ─────────────────────────────────────────────────────────
  const sourceMap: Record<string, { total: number; won: number }> = {};
  for (const { source, stage } of allLeads) {
    if (!sourceMap[source]) sourceMap[source] = { total: 0, won: 0 };
    sourceMap[source].total += 1;
    if (stage === "WON") sourceMap[source].won += 1;
  }

  let bestSource = "";
  let bestRate = 0;
  for (const [source, { total, won }] of Object.entries(sourceMap)) {
    if (total < 3) continue; // skip sources with too few leads for meaningful rate
    const rate = won / total;
    if (rate > bestRate) {
      bestRate = rate;
      bestSource = source;
    }
  }
  if (bestSource) {
    insights.push({
      type: "success",
      message: `${SOURCE_LABELS[bestSource] ?? bestSource} converts best (${Math.round(bestRate * 100)}% win rate)`,
    });
  }

  // ── C: Pipeline Bottleneck ─────────────────────────────────────────────────
  if (stageGroups.length > 0) {
    const top = stageGroups.sort((a, b) => b._count._all - a._count._all)[0];
    insights.push({
      type: "warning",
      message: `${top._count._all} leads stuck in "${STAGE_LABELS[top.stage] ?? top.stage}" stage`,
    });
  }

  // ── D: Activity Warning ────────────────────────────────────────────────────
  const recentlyActiveSet = new Set(recentActivityLeadIds.map((r) => r.leadId));
  const staleCount = activeLeadIds.filter((l) => !recentlyActiveSet.has(l.id)).length;

  if (staleCount > 0) {
    insights.push({
      type: "warning",
      message: `${staleCount} active lead${staleCount === 1 ? "" : "s"} with no follow-up in the last 3 days`,
    });
  } else if (activeLeadIds.length > 0) {
    insights.push({
      type: "success",
      message: "All active leads have been followed up in the last 3 days",
    });
  }

  return NextResponse.json(insights);
}
