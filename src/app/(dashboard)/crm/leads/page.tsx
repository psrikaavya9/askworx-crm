import { Suspense } from "react";
import { findLeads } from "@/modules/crm/repositories/lead.repository";
import { leadFiltersSchema } from "@/modules/crm/schemas/lead.schema";
import { LeadsTable } from "@/components/crm/leads/LeadsTable";
import { StatCard } from "@/components/ui/Card";
import { SectionBlock } from "@/components/ui/SectionBlock";
import { prisma } from "@/lib/prisma";
import { Users, TrendingUp, Trophy, Clock, BarChart2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { serializePrisma } from "@/lib/serialize";
import { autoGenerateFollowUpReminders } from "@/modules/crm/services/lead.service";

interface PageProps {
  searchParams: Promise<Record<string, string>>;
}

async function LeadStats() {
  const [total, won, pipeline, overdue] = await prisma.$transaction([
    prisma.lead.count(),
    prisma.lead.count({ where: { stage: "WON" } }),
    prisma.lead.aggregate({ where: { stage: { notIn: ["WON", "LOST"] } }, _sum: { dealValue: true } }),
    prisma.followUpReminder.count({ where: { status: { in: ["PENDING", "OVERDUE"] }, dueAt: { lt: new Date() } } }),
  ]);

  const convRate = total > 0 ? Math.round((won / total) * 100) : 0;

  return (
    <div className="grid grid-cols-4 gap-6">
      <StatCard label="Total Leads" value={total} icon={<Users className="h-5 w-5" />} color="indigo" />
      <StatCard label="Pipeline Value" value={formatCurrency(Number(pipeline._sum.dealValue ?? 0))}
        icon={<TrendingUp className="h-5 w-5" />} color="yellow" />
      <StatCard label="Won Leads" value={won} sub={`${convRate}% conversion`}
        icon={<Trophy className="h-5 w-5" />} color="green" />
      <StatCard label="Overdue Follow-ups" value={overdue}
        icon={<Clock className="h-5 w-5" />} color={overdue > 0 ? "red" : "indigo"} />
    </div>
  );
}

export default async function LeadsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = leadFiltersSchema.parse(params);
  const data = await findLeads(filters);

  // Fire-and-forget: auto-create follow-up reminders for stale leads (>3 days inactive)
  autoGenerateFollowUpReminders().catch(() => {/* silent — non-critical */});

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-8 py-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
        <p className="mt-1 text-sm text-gray-500">Track and manage your sales leads through the pipeline</p>
      </div>

      {/* KPI Section */}
      <SectionBlock
        title="Lead Overview"
        subtitle="Real-time pipeline metrics and conversion tracking"
        icon={<Users className="h-4.5 w-4.5 text-indigo-600" />}
        href="/crm/pipeline"
        hrefLabel="Pipeline view"
      >
        <Suspense fallback={<div className="grid grid-cols-4 gap-6">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-gray-100" />)}</div>}>
          <LeadStats />
        </Suspense>
      </SectionBlock>

      {/* Table Section */}
      <SectionBlock
        title="All Leads"
        subtitle="Full list of leads with filters and stage management"
        icon={<BarChart2 className="h-4.5 w-4.5 text-indigo-600" />}
      >
        <LeadsTable data={serializePrisma(data) as never} />
      </SectionBlock>
    </div>
  );
}
