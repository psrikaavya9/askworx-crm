"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users, TrendingUp, AlertTriangle, CheckSquare,
  BarChart2, Package, Clock, DollarSign,
  ArrowUpRight, ArrowDownRight, RefreshCw,
  Briefcase, ShoppingCart, Bell,
} from "lucide-react";
import { LeadTrendChart } from "@/components/dashboard/charts/LeadTrendChart";
import { FinanceBarChart } from "@/components/dashboard/charts/FinanceBarChart";
import { DonutChart } from "@/components/dashboard/charts/DonutChart";
import { RecentActivityPanel } from "@/components/dashboard/RecentActivity";
import type { AllKPIs } from "@/modules/dashboard/services/dashboard.service";
import type { ChartData, RecentActivity as RecentActivityType } from "@/modules/dashboard/services/chart.service";

// ─── helpers ────────────────────────────────────────────────────────────────

function fmt(n: number | undefined | null, prefix = ""): string {
  if (n == null) return "—";
  if (n >= 10_000_000) return `${prefix}${(n / 10_000_000).toFixed(1)}Cr`;
  if (n >= 100_000)    return `${prefix}${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000)      return `${prefix}${(n / 1_000).toFixed(0)}K`;
  return `${prefix}${n.toLocaleString("en-IN")}`;
}

function pct(n: number | undefined | null): string {
  if (n == null) return "—";
  return `${n.toFixed(1)}%`;
}

// ─── KPI Card ───────────────────────────────────────────────────────────────

interface KPICardProps {
  title: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  color: "blue" | "green" | "red" | "amber" | "purple" | "indigo";
  href?: string;
  trend?: { value: number; label: string };
}

const COLOR_MAP = {
  blue:   { bg: "bg-blue-50",   icon: "bg-blue-100 text-blue-600",   border: "border-blue-100",  val: "text-blue-700" },
  green:  { bg: "bg-green-50",  icon: "bg-green-100 text-green-600",  border: "border-green-100", val: "text-green-700" },
  red:    { bg: "bg-red-50",    icon: "bg-red-100 text-red-600",      border: "border-red-100",   val: "text-red-700" },
  amber:  { bg: "bg-amber-50",  icon: "bg-amber-100 text-amber-600",  border: "border-amber-100", val: "text-amber-700" },
  purple: { bg: "bg-purple-50", icon: "bg-purple-100 text-purple-600",border: "border-purple-100",val: "text-purple-700" },
  indigo: { bg: "bg-indigo-50", icon: "bg-indigo-100 text-indigo-600",border: "border-indigo-100",val: "text-indigo-700" },
};

function KPICard({ title, value, sub, icon, color, href, trend }: KPICardProps) {
  const c = COLOR_MAP[color];
  const inner = (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-5 transition-all hover:shadow-md`}>
      <div className="flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${c.icon}`}>
          {icon}
        </div>
        {trend != null && (
          <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
            trend.value >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
          }`}>
            {trend.value >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(trend.value).toFixed(0)}%
          </span>
        )}
      </div>
      <p className={`mt-4 text-2xl font-bold ${c.val}`}>{value}</p>
      <p className="mt-0.5 text-sm font-medium text-gray-600">{title}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  );

  if (href) return <Link href={href}>{inner}</Link>;
  return inner;
}

// ─── Section Header ──────────────────────────────────────────────────────────

function Section({ title, href, children }: { title: string; href?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">{title}</h2>
        {href && (
          <Link href={href} className="text-xs font-medium text-indigo-600 hover:underline flex items-center gap-1">
            View all <ArrowUpRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-gray-100 ${className}`} />;
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [kpis, setKpis]       = useState<AllKPIs | null>(null);
  const [charts, setCharts]   = useState<ChartData | null>(null);
  const [activity, setActivity] = useState<RecentActivityType | null>(null);
  const [loading, setLoading]   = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  async function loadAll() {
    setLoading(true);
    try {
      const [kRes, cRes, aRes] = await Promise.all([
        fetch("/api/dashboard/kpis"),
        fetch("/api/dashboard/charts"),
        fetch("/api/dashboard/activity"),
      ]);
      const [k, c, a] = await Promise.all([kRes.json(), cRes.json(), aRes.json()]);
      setKpis(k);
      setCharts(c);
      setActivity(a);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Dashboard load failed", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  const crm       = kpis?.crm;
  const projects  = kpis?.projects;
  const finance   = kpis?.finance;
  const inventory = kpis?.inventory;
  const staff     = kpis?.staff;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* ── Header ── */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {lastUpdated
              ? `Last updated: ${lastUpdated.toLocaleTimeString()}`
              : "Loading live data…"}
          </p>
        </div>
        <button
          onClick={loadAll}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 shadow-sm hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* ── CRM KPIs ── */}
      <Section title="CRM" href="/crm/leads">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 mb-6">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32" />)
          ) : (
            <>
              <KPICard
                title="Total Leads"
                value={String(crm?.totalLeads ?? 0)}
                sub={`${crm?.leadsThisMonth ?? 0} this month`}
                icon={<Users className="h-5 w-5" />}
                color="indigo"
                href="/crm/leads"
              />
              <KPICard
                title="Qualified Leads"
                value={String(crm?.qualifiedLeads ?? 0)}
                sub={`${pct(crm?.conversionRate)} conversion`}
                icon={<TrendingUp className="h-5 w-5" />}
                color="blue"
                href="/crm/leads?stage=QUALIFIED"
              />
              <KPICard
                title="Won Deals"
                value={String(crm?.wonLeads ?? 0)}
                sub={`${fmt(crm?.pipelineValue, "₹")} pipeline`}
                icon={<CheckSquare className="h-5 w-5" />}
                color="green"
                href="/crm/leads?stage=WON"
              />
              <KPICard
                title="Overdue Follow-ups"
                value={String(crm?.overdueFollowUps ?? 0)}
                sub="require attention"
                icon={<Bell className="h-5 w-5" />}
                color={crm?.overdueFollowUps ? "red" : "green"}
                href="/crm/reminders"
              />
              <KPICard
                title="Avg Deal Value"
                value={fmt(crm?.avgDealValue, "₹")}
                sub="per opportunity"
                icon={<DollarSign className="h-5 w-5" />}
                color="purple"
              />
              <KPICard
                title="Clients"
                value={String(crm?.convertedClients ?? 0)}
                sub="converted leads"
                icon={<Briefcase className="h-5 w-5" />}
                color="amber"
                href="/crm/clients"
              />
            </>
          )}
        </div>
      </Section>

      {/* ── Finance KPIs ── */}
      <Section title="Finance" href="/finance">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 mb-6">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)
          ) : (
            <>
              <KPICard
                title="Total Revenue"
                value={fmt(finance?.totalRevenue, "₹")}
                sub={`Net profit: ${fmt(finance?.netProfit, "₹")}`}
                icon={<TrendingUp className="h-5 w-5" />}
                color="green"
                href="/finance"
              />
              <KPICard
                title="Outstanding"
                value={fmt(finance?.outstandingInvoices, "₹")}
                sub={`${finance?.overdueInvoices ?? 0} overdue invoices`}
                icon={<AlertTriangle className="h-5 w-5" />}
                color={finance?.overdueInvoices ? "red" : "amber"}
                href="/finance"
              />
              <KPICard
                title="Total Invoices"
                value={String(finance?.totalInvoices ?? 0)}
                sub={`${finance?.paidInvoices ?? 0} paid`}
                icon={<BarChart2 className="h-5 w-5" />}
                color="blue"
                href="/finance"
              />
              <KPICard
                title="Profit Margin"
                value={pct(finance?.profitMargin)}
                sub={`Expenses: ${fmt(finance?.totalExpenses, "₹")}`}
                icon={<DollarSign className="h-5 w-5" />}
                color="purple"
              />
            </>
          )}
        </div>
      </Section>

      {/* ── Projects & Inventory KPIs ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mb-6">
        <Section title="Projects" href="/projects">
          <div className="grid grid-cols-2 gap-4">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
            ) : (
              <>
                <KPICard
                  title="Active Projects"
                  value={String(projects?.activeProjects ?? 0)}
                  sub={`${projects?.totalProjects ?? 0} total`}
                  icon={<Briefcase className="h-5 w-5" />}
                  color="blue"
                  href="/projects"
                />
                <KPICard
                  title="Delayed"
                  value={String(projects?.delayedProjects ?? 0)}
                  sub="past deadline"
                  icon={<AlertTriangle className="h-5 w-5" />}
                  color={projects?.delayedProjects ? "red" : "green"}
                  href="/projects"
                />
                <KPICard
                  title="Tasks Pending"
                  value={String(projects?.tasksPending ?? 0)}
                  sub={`${projects?.tasksCompleted ?? 0} completed`}
                  icon={<CheckSquare className="h-5 w-5" />}
                  color="amber"
                  href="/projects"
                />
                <KPICard
                  title="Hours Logged"
                  value={fmt(projects?.totalHoursLogged)}
                  sub="total across tasks"
                  icon={<Clock className="h-5 w-5" />}
                  color="indigo"
                />
              </>
            )}
          </div>
        </Section>

        <Section title="Inventory" href="/products">
          <div className="grid grid-cols-2 gap-4">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
            ) : (
              <>
                <KPICard
                  title="Total Products"
                  value={String(inventory?.totalProducts ?? 0)}
                  sub="in catalogue"
                  icon={<Package className="h-5 w-5" />}
                  color="blue"
                  href="/products"
                />
                <KPICard
                  title="Low Stock"
                  value={String(inventory?.lowStockItems ?? 0)}
                  sub="need restocking"
                  icon={<AlertTriangle className="h-5 w-5" />}
                  color={inventory?.lowStockItems ? "red" : "green"}
                  href="/products"
                />
                <KPICard
                  title="Inventory Value"
                  value={fmt(inventory?.inventoryValue, "₹")}
                  sub="current stock value"
                  icon={<ShoppingCart className="h-5 w-5" />}
                  color="purple"
                />
                <KPICard
                  title="Attendance Today"
                  value={String(staff?.presentToday ?? 0)}
                  sub={`${staff?.attendanceRate ?? 0}% attendance rate`}
                  icon={<Users className="h-5 w-5" />}
                  color="green"
                  href="/attendance"
                />
              </>
            )}
          </div>
        </Section>
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mb-6">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">Lead Trend (6 months)</h3>
          {loading ? (
            <Skeleton className="h-52" />
          ) : charts?.leadsTrend ? (
            <LeadTrendChart data={charts.leadsTrend} height={220} />
          ) : (
            <p className="flex items-center justify-center h-52 text-sm text-gray-400">No data</p>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">Revenue vs Expenses</h3>
          {loading ? (
            <Skeleton className="h-52" />
          ) : charts?.financeTrend ? (
            <FinanceBarChart data={charts.financeTrend} height={220} />
          ) : (
            <p className="flex items-center justify-center h-52 text-sm text-gray-400">No data</p>
          )}
        </div>
      </div>

      {/* ── Stage + Project Distribution ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 mb-6">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">Lead by Stage</h3>
          {loading ? (
            <Skeleton className="h-48" />
          ) : charts?.leadsBySource ? (
            <DonutChart data={charts.leadsBySource} title="Source" height={200} />
          ) : (
            <p className="flex items-center justify-center h-48 text-sm text-gray-400">No data</p>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">Project Status</h3>
          {loading ? (
            <Skeleton className="h-48" />
          ) : charts?.projectStatusDist ? (
            <DonutChart data={charts.projectStatusDist} title="Status" height={200} />
          ) : (
            <p className="flex items-center justify-center h-48 text-sm text-gray-400">No data</p>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">Task Status</h3>
          {loading ? (
            <Skeleton className="h-48" />
          ) : charts?.taskStatusDist ? (
            <DonutChart data={charts.taskStatusDist} title="Tasks" height={200} />
          ) : (
            <p className="flex items-center justify-center h-48 text-sm text-gray-400">No data</p>
          )}
        </div>
      </div>

      {/* ── Recent Activity ── */}
      {!loading && activity && (
        <Section title="Recent Activity">
          <RecentActivityPanel activity={activity} />
        </Section>
      )}
      {loading && (
        <Section title="Recent Activity">
          <Skeleton className="h-48" />
        </Section>
      )}
    </div>
  );
}
