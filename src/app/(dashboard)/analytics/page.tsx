"use client";

import { useEffect, useState } from "react";
import { Loader2, Users, Kanban, Wallet, Package, TrendingUp, CheckCircle2, Activity } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/Card";
import { SectionBlock } from "@/components/ui/SectionBlock";
import { InsightsPanel } from "@/components/dashboard/InsightsPanel";
import type { Insight } from "@/app/api/analytics/insights/route";
import { AutomationLogsPanel } from "@/components/dashboard/AutomationLogsPanel";
import type { AutomationLogEntry } from "@/app/api/analytics/automation-logs/route";
import { DonutChart } from "@/components/dashboard/charts/DonutChart";
import { LeadTrendChart } from "@/components/dashboard/charts/LeadTrendChart";
import { FinanceBarChart } from "@/components/dashboard/charts/FinanceBarChart";
import { ProfitLineChart } from "@/components/dashboard/charts/ProfitLineChart";
import { TaskBarChart } from "@/components/dashboard/charts/TaskBarChart";
import { InventoryValueChart, LowStockChart } from "@/components/dashboard/charts/InventoryBarChart";
import type { ChartData } from "@/modules/dashboard/services/chart.service";

interface WinLossEntry { status: string; count: number; }
interface LossReason { name: string; value: number; color: string; }
interface CrmSummary { conversionRate: number; crmRevenue: number; totalLeads: number; wonLeads: number; }

const WIN_LOSS_COLORS: Record<string, string> = { WON: "#22c55e", LOST: "#ef4444" };
const WIN_LOSS_LABELS: Record<string, string> = { WON: "Won", LOST: "Lost" };

function formatINR(value: number): string {
  if (value >= 10_00_000) return `₹${(value / 10_00_000).toFixed(1)}L`;
  if (value >= 1_000) return `₹${(value / 1_000).toFixed(0)}K`;
  return `₹${value.toLocaleString("en-IN")}`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AnalyticsPage() {
  const [charts, setCharts] = useState<ChartData | null>(null);
  const [crmSummary, setCrmSummary] = useState<CrmSummary | null>(null);
  const [winLoss, setWinLoss] = useState<WinLossEntry[]>([]);
  const [lossReasons, setLossReasons] = useState<LossReason[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [automationLogs, setAutomationLogs] = useState<AutomationLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard/charts").then((r) => { if (!r.ok) throw new Error("Failed to load analytics"); return r.json(); }),
      fetch("/api/analytics/crm-summary").then((r) => r.json()),
      fetch("/api/analytics/crm-win-loss").then((r) => r.json()),
      fetch("/api/analytics/crm-loss-reasons").then((r) => r.json()),
      fetch("/api/analytics/insights").then((r) => r.json()),
      fetch("/api/analytics/automation-logs").then((r) => r.json()),
    ])
      .then(([chartData, summary, wl, lr, insightsData, logsData]) => {
        setCharts(chartData as ChartData);
        setCrmSummary(summary as CrmSummary);
        setWinLoss(wl as WinLossEntry[]);
        setLossReasons(lr as LossReason[]);
        setInsights(insightsData as Insight[]);
        setAutomationLogs(logsData as AutomationLogEntry[]);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error || !charts || !crmSummary) {
    return (
      <div className="flex h-full items-center justify-center">
        <Card>
          <p className="text-sm text-red-600">{error ?? "Failed to load analytics"}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-8 py-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="mt-1 text-sm text-gray-500">Charts and trends across all modules</p>
      </div>

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

      {/* CRM Analytics */}
      <SectionBlock
        title="CRM & Leads"
        subtitle="Lead sources and monthly conversion performance"
        icon={<Users className="h-4.5 w-4.5 text-indigo-600" />}
        href="/crm/leads"
        hrefLabel="View leads"
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Card><DonutChart data={charts.leadsBySource} title="Lead Source Distribution" height={260} /></Card>
          <Card><LeadTrendChart data={charts.leadsTrend} height={260} /></Card>
        </div>
      </SectionBlock>

      {/* Sales Performance */}
      <SectionBlock
        title="Sales Performance"
        subtitle="Conversion rate, win/loss split, revenue from closed deals, and loss analysis"
        icon={<TrendingUp className="h-4.5 w-4.5 text-emerald-600" />}
        href="/crm/leads"
        hrefLabel="View leads"
      >
        <div className="space-y-5">
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            <StatCard
              label="Conversion Rate"
              value={`${crmSummary.conversionRate.toFixed(1)}%`}
              sub="Won / Total leads"
              icon={<TrendingUp className="h-5 w-5" />}
              color={crmSummary.conversionRate >= 20 ? "green" : crmSummary.conversionRate >= 10 ? "yellow" : "red"}
            />
            <StatCard
              label="CRM Revenue"
              value={formatINR(crmSummary.crmRevenue)}
              sub="Sum of won deal values"
              icon={<Wallet className="h-5 w-5" />}
              color="green"
            />
            <StatCard
              label="Won Deals"
              value={crmSummary.wonLeads}
              sub={`of ${crmSummary.totalLeads} total leads`}
              icon={<CheckCircle2 className="h-5 w-5" />}
              color="indigo"
            />
            <StatCard
              label="Lost Deals"
              value={winLoss.find((w) => w.status === "LOST")?.count ?? 0}
              sub="All time"
              icon={<Users className="h-5 w-5" />}
              color="red"
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Card>
              <DonutChart
                data={winLoss.map((w) => ({
                  name: WIN_LOSS_LABELS[w.status] ?? w.status,
                  value: w.count,
                  color: WIN_LOSS_COLORS[w.status] ?? "#94a3b8",
                }))}
                title="Won vs Lost"
                height={260}
              />
            </Card>
            <Card>
              <DonutChart
                data={lossReasons}
                title="Loss Reasons"
                height={260}
              />
            </Card>
          </div>
        </div>
      </SectionBlock>

      {/* Project Analytics */}
      <SectionBlock
        title="Projects & Tasks"
        subtitle="Project status breakdown and task completion"
        icon={<Kanban className="h-4.5 w-4.5 text-purple-600" />}
        href="/projects"
        hrefLabel="View projects"
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Card><DonutChart data={charts.projectStatusDist} title="Project Status Distribution" height={260} /></Card>
          <Card><TaskBarChart data={charts.taskStatusDist} height={260} /></Card>
        </div>
      </SectionBlock>

      {/* Finance Analytics */}
      <SectionBlock
        title="Finance"
        subtitle="Monthly revenue, expenses, and net profit trend"
        icon={<Wallet className="h-4.5 w-4.5 text-emerald-600" />}
        href="/finance/invoices"
        hrefLabel="View invoices"
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Card><FinanceBarChart data={charts.financeTrend} height={260} /></Card>
          <Card><ProfitLineChart data={charts.financeTrend} height={260} /></Card>
        </div>
      </SectionBlock>

      {/* Inventory Analytics */}
      <SectionBlock
        title="Inventory"
        subtitle="Product value distribution and low stock alerts"
        icon={<Package className="h-4.5 w-4.5 text-orange-600" />}
        href="/products"
        hrefLabel="View products"
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Card><InventoryValueChart data={charts.inventoryByProduct} height={260} /></Card>
          <Card><LowStockChart data={charts.lowStockProducts} height={260} /></Card>
        </div>
      </SectionBlock>

      {/* Automation Logs */}
      <SectionBlock
        title="Automation Log"
        subtitle="History of rules fired by the hourly automation job"
        icon={<Activity className="h-4.5 w-4.5 text-violet-600" />}
      >
        <AutomationLogsPanel logs={automationLogs} />
      </SectionBlock>
    </div>
  );
}
