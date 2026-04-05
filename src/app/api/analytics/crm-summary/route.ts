import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const [totalLeads, wonLeads, wonDealValue] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({ where: { stage: "WON" } }),
    prisma.lead.aggregate({
      where: { stage: "WON", dealValue: { not: null } },
      _sum: { dealValue: true },
    }),
  ]);

  const conversionRate = totalLeads > 0
    ? Math.round((wonLeads / totalLeads) * 100 * 10) / 10
    : 0;

  const crmRevenue = Number(wonDealValue._sum.dealValue ?? 0);

  return NextResponse.json({ conversionRate, crmRevenue, totalLeads, wonLeads });
}
