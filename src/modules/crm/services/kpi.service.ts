import { prisma } from "@/lib/prisma";
import type { CRMDashboardKPI, PipelineKPI, SourceKPI, PipelineStage, LeadSource } from "../types";
import { PIPELINE_STAGES, PIPELINE_STAGE_LABELS, LEAD_SOURCE_LABELS } from "../types";

type LeadSummary = {
  id: string;
  stage: PipelineStage;
  source: LeadSource;
  dealValue: { toNumber(): number } | null;
  createdAt: Date;
  convertedAt: Date | null;
  lostAt: Date | null;
};

/**
 * Compute CRM dashboard KPIs for a given time window.
 * @param startDate  Start of the period (defaults to 30 days ago)
 * @param endDate    End of the period (defaults to now)
 */
export async function getCRMDashboardKPI(
  startDate?: Date,
  endDate?: Date
): Promise<CRMDashboardKPI> {
  const now = new Date();
  const from = startDate ?? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const to = endDate ?? now;

  const [rawLeads, overdueCount] = await prisma.$transaction([
    prisma.lead.findMany({
      select: {
        id: true,
        stage: true,
        source: true,
        dealValue: true,
        createdAt: true,
        convertedAt: true,
        lostAt: true,
      },
    }),
    prisma.followUpReminder.count({
      where: { status: { in: ["PENDING", "OVERDUE"] }, dueAt: { lt: now } },
    }),
  ]);

  const allLeads = rawLeads as LeadSummary[];

  const periodLeads = allLeads.filter((l) => l.createdAt >= from && l.createdAt <= to);
  const wonInPeriod = periodLeads.filter((l) => l.stage === "WON");
  const lostInPeriod = periodLeads.filter((l) => l.stage === "LOST");

  const totalValue = allLeads
    .filter((l) => l.stage !== "LOST")
    .reduce((sum, l) => sum + Number(l.dealValue ?? 0), 0);

  const wonValue = wonInPeriod.reduce((sum, l) => sum + Number(l.dealValue ?? 0), 0);

  // Pipeline stage breakdown
  const pipeline: PipelineKPI[] = PIPELINE_STAGES.filter(
    (s) => s !== "LOST"
  ).map((stage, idx) => {
    const stageLeads = allLeads.filter((l) => l.stage === stage);
    const prevStageLeads =
      idx === 0
        ? allLeads
        : allLeads.filter((l) => l.stage === PIPELINE_STAGES[idx - 1]);

    const conversionRate =
      prevStageLeads.length > 0
        ? Math.round((stageLeads.length / prevStageLeads.length) * 100 * 10) / 10
        : null;

    return {
      stage,
      label: PIPELINE_STAGE_LABELS[stage],
      count: stageLeads.length,
      totalValue: stageLeads.reduce((s, l) => s + Number(l.dealValue ?? 0), 0),
      conversionRate,
    };
  });

  // Source performance
  const sources = [...new Set(allLeads.map((l) => l.source))];
  const bySource: SourceKPI[] = sources.map((source) => {
    const srcLeads = allLeads.filter((l) => l.source === source);
    const won = srcLeads.filter((l) => l.stage === "WON");
    return {
      source,
      label: LEAD_SOURCE_LABELS[source],
      total: srcLeads.length,
      won: won.length,
      conversionRate:
        srcLeads.length > 0
          ? Math.round((won.length / srcLeads.length) * 100 * 10) / 10
          : 0,
      totalValue: won.reduce((s, l) => s + Number(l.dealValue ?? 0), 0),
    };
  });

  const totalPeriodLeads = periodLeads.length;
  const overallConversionRate =
    totalPeriodLeads > 0
      ? Math.round((wonInPeriod.length / totalPeriodLeads) * 100 * 10) / 10
      : 0;

  return {
    totalLeads: allLeads.length,
    newThisPeriod: totalPeriodLeads,
    wonThisPeriod: wonInPeriod.length,
    lostThisPeriod: lostInPeriod.length,
    overallConversionRate,
    totalPipelineValue: totalValue,
    avgDealValue: wonInPeriod.length > 0 ? Math.round(wonValue / wonInPeriod.length) : 0,
    overdueReminders: overdueCount,
    pipeline,
    bySource,
  };
}
