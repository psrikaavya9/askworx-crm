"use client";

import { useEffect, useState } from "react";
import {
  Users,
  Kanban,
  UserCheck,
  Wallet,
  Package,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Clock,
  BarChart3,
  ShoppingCart,
  Layers,
  Loader2,
  Activity,
  Phone,
  Mail,
  MessageCircle,
  LineChart as LineChartIcon,
} from "lucide-react";
import { StatCard, Card } from "@/components/ui/Card";
import { SectionBlock } from "@/components/ui/SectionBlock";
import { HeroCard } from "@/components/ui/HeroCard";
import { RecentActivityPanel } from "@/components/dashboard/RecentActivity";
import type { AllKPIs } from "@/modules/dashboard/services/dashboard.service";
import type { ChartData } from "@/modules/dashboard/services/chart.service";
import type { RecentActivity } from "@/modules/dashboard/services/chart.service";
import { DonutChart } from "@/components/dashboard/charts/DonutChart";
import { LeadTrendChart } from "@/components/dashboard/charts/LeadTrendChart";
import { FinanceBarChart } from "@/components/dashboard/charts/FinanceBarChart";
import { ProfitLineChart } from "@/components/dashboard/charts/ProfitLineChart";
import { TaskBarChart } from "@/components/dashboard/charts/TaskBarChart";
import { InventoryValueChart, LowStockChart } from "@/components/dashboard/charts/InventoryBarChart";
import { LossReasonsChart } from "@/components/dashboard/charts/LossReasonsChart";
import { RevenueTrendChart } from "@/components/dashboard/charts/RevenueTrendChart";
import { StageConversionChart } from "@/components/dashboard/charts/StageConversionChart";
import { InsightsPanel } from "@/components/dashboard/InsightsPanel";
import type { Insight } from "@/app/api/analytics/insights/route";

interface ActivityMetrics { calls: number; emails: number; whatsapp: number; }
interface RevenueTrendPoint { month: string; revenue: number; }
interface PiePoint { name: string; value: number; color: string; }

function formatINR(value: number): string {
  if (value >= 10_00_000) return `₹${(value / 10_00_000).toFixed(1)}L`;
  if (value >= 1_000) return `₹${(value / 1_000).toFixed(0)}K`;
  return `₹${value.toLocaleString("en-IN")}`;
}

// ---------------------------------------------------------------------------
// KPI sections
// ---------------------------------------------------------------------------

function KPISection({ kpis }: { kpis: AllKPIs }) {
  const { crm, projects, staff, finance, inventory } = kpis;

  return (
    <div className="space-y-6">
      <SectionBlock
        title="CRM & Leads"
        subtitle="Pipeline performance and lead conversion"
        href="/crm/leads"
        icon={<Users className="h-4.5 w-4.5 text-blue-500" />}
      >
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          <StatCard label="Total Leads" value={crm.totalLeads} sub="All time" icon={<Users className="h-5 w-5" />} color="indigo" />
          <StatCard label="Pipeline Value" value={formatINR(crm.pipelineValue)} sub="Active deals" icon={<TrendingUp className="h-5 w-5" />} color="purple" />
          <StatCard label="Won Leads" value={crm.wonLeads} sub="All time" icon={<CheckCircle2 className="h-5 w-5" />} color="green" />
          <StatCard label="Overdue Follow-ups" value={crm.overdueFollowUps} sub="Need attention" icon={<AlertTriangle className="h-5 w-5" />} color={crm.overdueFollowUps > 0 ? "red" : "green"} />
        </div>
      </SectionBlock>

      <SectionBlock
        title="Projects & Tasks"
        subtitle="Active work, deadlines, and progress"
        href="/projects"
        icon={<Kanban className="h-4.5 w-4.5 text-purple-500" />}
      >
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          <StatCard label="Total Projects" value={projects.totalProjects} sub="All time" icon={<Layers className="h-5 w-5" />} color="indigo" />
          <StatCard label="Active" value={projects.activeProjects} sub="In progress" icon={<TrendingUp className="h-5 w-5" />} color="purple" />
          <StatCard label="Completed" value={projects.completedProjects} sub="Finished" icon={<CheckCircle2 className="h-5 w-5" />} color="green" />
          <StatCard label="Delayed" value={projects.delayedProjects} sub="Past deadline" icon={<AlertTriangle className="h-5 w-5" />} color={projects.delayedProjects > 0 ? "red" : "green"} />
        </div>
      </SectionBlock>

      <SectionBlock
        title="Staff & Attendance"
        subtitle="Today's workforce status"
        href="/attendance"
        icon={<UserCheck className="h-4.5 w-4.5 text-cyan-500" />}
      >
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          <StatCard label="Total Staff" value={staff.totalStaff} sub="Active members" icon={<Users className="h-5 w-5" />} color="teal" />
          <StatCard label="Present Today" value={staff.presentToday} sub="Checked in" icon={<CheckCircle2 className="h-5 w-5" />} color="green" />
          <StatCard label="Absent Today" value={staff.absentToday} sub="Not checked in" icon={<AlertTriangle className="h-5 w-5" />} color={staff.absentToday > 0 ? "red" : "green"} />
          <StatCard label="Late" value={staff.lateCheckIns} sub="Today" icon={<Clock className="h-5 w-5" />} color={staff.lateCheckIns > 0 ? "yellow" : "green"} />
        </div>
      </SectionBlock>

      <SectionBlock
        title="Finance"
        subtitle="Revenue, invoices, and expenses"
        href="/finance/invoices"
        icon={<Wallet className="h-4.5 w-4.5 text-green-500" />}
      >
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          <StatCard label="Total Invoices" value={finance.totalInvoices} sub="All statuses" icon={<BarChart3 className="h-5 w-5" />} color="indigo" />
          <StatCard label="Paid Invoices" value={finance.paidInvoices} sub={`${formatINR(finance.totalRevenue)} collected`} icon={<CheckCircle2 className="h-5 w-5" />} color="green" />
          <StatCard label="Outstanding" value={formatINR(finance.outstandingInvoices)} sub={`${finance.overdueInvoices} overdue`} icon={<AlertTriangle className="h-5 w-5" />} color={finance.overdueInvoices > 0 ? "red" : "yellow"} />
          <StatCard label="Expenses" value={formatINR(finance.totalExpenses)} sub="Approved" icon={<ShoppingCart className="h-5 w-5" />} color="orange" />
        </div>
      </SectionBlock>

      <SectionBlock
        title="Inventory"
        subtitle="Stock levels and recent movements"
        href="/products"
        icon={<Package className="h-4.5 w-4.5 text-orange-500" />}
      >
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          <StatCard label="Products" value={inventory.totalProducts} sub="In catalogue" icon={<Package className="h-5 w-5" />} color="indigo" />
          <StatCard label="Low Stock" value={inventory.lowStockItems} sub="Needs reorder" icon={<AlertTriangle className="h-5 w-5" />} color={inventory.lowStockItems > 0 ? "red" : "green"} />
          <StatCard label="Inv. Value" value={formatINR(inventory.inventoryValue)} sub="At cost" icon={<Wallet className="h-5 w-5" />} color="green" />
          <StatCard label="Movements" value={inventory.recentStockMovements} sub="Last 7 days" icon={<BarChart3 className="h-5 w-5" />} color="teal" />
        </div>
      </SectionBlock>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Charts section
// ---------------------------------------------------------------------------

function ChartsSection({ charts }: { charts: ChartData }) {
  return (
    <SectionBlock
      title="Charts & Trends"
      subtitle="Visual overview of performance across all modules"
      href="/analytics"
      icon={<BarChart3 className="h-4.5 w-4.5 text-blue-500" />}
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card>
            <DonutChart data={charts.leadsBySource} title="Lead Source Distribution" height={240} />
          </Card>
          <Card>
            <LeadTrendChart data={charts.leadsTrend} height={240} />
          </Card>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card>
            <DonutChart data={charts.projectStatusDist} title="Project Status Distribution" height={240} />
          </Card>
          <Card>
            <TaskBarChart data={charts.taskStatusDist} height={240} />
          </Card>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card>
            <FinanceBarChart data={charts.financeTrend} height={240} />
          </Card>
          <Card>
            <ProfitLineChart data={charts.financeTrend} height={240} />
          </Card>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card>
            <InventoryValueChart data={charts.inventoryByProduct} height={240} />
          </Card>
          <Card>
            <LowStockChart data={charts.lowStockProducts} height={240} />
          </Card>
        </div>
      </div>
    </SectionBlock>
  );
}

// ---------------------------------------------------------------------------
// Analytics section
// ---------------------------------------------------------------------------

interface AnalyticsSectionProps {
  conversionRate: number;
  activityMetrics: ActivityMetrics;
  lossReasons: PiePoint[];
  revenueTrend: RevenueTrendPoint[];
  stageData: PiePoint[];
}

function AnalyticsSection({
  conversionRate,
  activityMetrics,
  lossReasons,
  revenueTrend,
  stageData,
}: AnalyticsSectionProps) {
  return (
    <SectionBlock
      title="Analytics"
      subtitle="Business insights and conversion intelligence"
      href="/analytics"
      icon={<LineChartIcon className="h-4.5 w-4.5 text-indigo-500" />}
    >
      <div className="space-y-6">
        {/* Row 1: Conversion rate + Activity metrics */}
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          <StatCard
            label="Conversion Rate"
            value={`${conversionRate.toFixed(1)}%`}
            sub="Won / Total leads"
            icon={<TrendingUp className="h-5 w-5" />}
            color={conversionRate >= 20 ? "green" : conversionRate >= 10 ? "yellow" : "red"}
          />
          <StatCard
            label="Calls Made"
            value={activityMetrics.calls}
            sub="All time"
            icon={<Phone className="h-5 w-5" />}
            color="indigo"
          />
          <StatCard
            label="Emails Sent"
            value={activityMetrics.emails}
            sub="All time"
            icon={<Mail className="h-5 w-5" />}
            color="purple"
          />
          <StatCard
            label="WhatsApp"
            value={activityMetrics.whatsapp}
            sub="All time"
            icon={<MessageCircle className="h-5 w-5" />}
            color="teal"
          />
        </div>

        {/* Row 2: Revenue trend + Stage conversion */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card>
            <RevenueTrendChart data={revenueTrend} height={240} />
          </Card>
          <Card>
            <StageConversionChart data={stageData} height={240} />
          </Card>
        </div>

        {/* Row 3: Loss reasons */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card>
            <LossReasonsChart data={lossReasons} height={240} />
          </Card>
          <Card className="flex flex-col justify-center p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-4">
              Deal Summary
            </p>
            <div className="space-y-3">
              {stageData.map((s) => {
                const total = stageData.reduce((acc, d) => acc + d.value, 0);
                const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
                return (
                  <div key={s.name} className="flex items-center gap-3">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="flex-1 text-sm text-gray-700">{s.name}</span>
                    <span className="text-sm font-semibold text-gray-900">{s.value}</span>
                    <span className="w-10 text-right text-xs text-gray-400">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </SectionBlock>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const [kpis, setKpis] = useState<AllKPIs | null>(null);
  const [charts, setCharts] = useState<ChartData | null>(null);
  const [activity, setActivity] = useState<RecentActivity | null>(null);
  const [activityMetrics, setActivityMetrics] = useState<ActivityMetrics | null>(null);
  const [revenueTrend, setRevenueTrend] = useState<RevenueTrendPoint[]>([]);
  const [lossReasons, setLossReasons] = useState<PiePoint[]>([]);
  const [stageData, setStageData] = useState<PiePoint[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard/kpis").then((r) => r.json()),
      fetch("/api/dashboard/charts").then((r) => r.json()),
      fetch("/api/dashboard/activity").then((r) => r.json()),
      fetch("/api/analytics/activity").then((r) => r.json()),
      fetch("/api/analytics/revenue-trend").then((r) => r.json()),
      fetch("/api/analytics/loss-reasons").then((r) => r.json()),
      fetch("/api/analytics/stages").then((r) => r.json()),
      fetch("/api/analytics/insights").then((r) => r.json()),
    ])
      .then(([kpiData, chartData, activityData, actMetrics, revTrend, lossData, stages, insightsData]) => {
        setKpis(kpiData as AllKPIs);
        setCharts(chartData as ChartData);
        setActivity(activityData as RecentActivity);
        setActivityMetrics(actMetrics as ActivityMetrics);
        setRevenueTrend(revTrend as RevenueTrendPoint[]);
        setLossReasons(lossData as PiePoint[]);
        setStageData(stages as PiePoint[]);
        setInsights(insightsData as Insight[]);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
          <p className="text-sm text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !kpis || !charts || !activity || !activityMetrics) {
    return (
      <div className="flex h-full items-center justify-center">
        <Card>
          <p className="text-sm text-red-600">{error ?? "Failed to load dashboard"}</p>
        </Card>
      </div>
    );
  }

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const heroStats = [
    { label: "Leads", value: kpis.crm.totalLeads },
    { label: "Pipeline", value: formatINR(kpis.crm.pipelineValue) },
    { label: "Projects", value: kpis.projects.activeProjects },
    { label: "Revenue", value: formatINR(kpis.finance.totalRevenue) },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-8 py-6">
      {/* Hero banner */}
      <HeroCard
        title="ASKworX Business"
        subtitle={today}
        badge="Live"
        badgeColor="green"
        initials=""
        stats={heroStats}
      />

      {/* Smart Insights */}
      {insights.length > 0 && (
        <SectionBlock
          title="Smart Insights"
          subtitle="Rule-based signals from your CRM data"
          icon={<Activity className="h-4.5 w-4.5 text-amber-500" />}
        >
          <InsightsPanel insights={insights} />
        </SectionBlock>
      )}

      {/* KPI sections */}
      <KPISection kpis={kpis} />

      {/* Charts */}
      <ChartsSection charts={charts} />

      {/* Analytics */}
      <AnalyticsSection
        conversionRate={kpis.crm.conversionRate}
        activityMetrics={activityMetrics}
        lossReasons={lossReasons}
        revenueTrend={revenueTrend}
        stageData={stageData}
      />

      {/* Recent activity */}
      <SectionBlock
        title="Recent Activity"
        subtitle="Latest updates across all modules"
        href="/analytics"
        icon={<Activity className="h-4.5 w-4.5 text-purple-500" />}
      >
        <RecentActivityPanel activity={activity} />
      </SectionBlock>
    </div>
  );
}
