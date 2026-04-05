"use client";

import Link from "next/link";
import { Users, Kanban, Wallet, ShoppingCart, Package, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { timeAgo } from "@/lib/utils";
import type { RecentActivity } from "@/modules/dashboard/services/chart.service";

const STAGE_VARIANTS: Record<string, "gray" | "blue" | "yellow" | "purple" | "green" | "red" | "indigo" | "orange"> = {
  NEW: "gray",
  CONTACTED: "blue",
  QUALIFIED: "indigo",
  PROPOSAL: "purple",
  WON: "green",
  LOST: "red",
};

const PROJECT_STATUS_VARIANTS: Record<string, "gray" | "blue" | "yellow" | "purple" | "green" | "red" | "indigo" | "orange"> = {
  PLANNING: "indigo",
  ACTIVE: "green",
  ON_HOLD: "yellow",
  COMPLETED: "blue",
};

const INVOICE_STATUS_VARIANTS: Record<string, "gray" | "blue" | "yellow" | "purple" | "green" | "red" | "indigo" | "orange"> = {
  DRAFT: "gray",
  SENT: "blue",
  PAID: "green",
  OVERDUE: "red",
};

const EXPENSE_STATUS_VARIANTS: Record<string, "gray" | "blue" | "yellow" | "purple" | "green" | "red" | "indigo" | "orange"> = {
  PENDING: "yellow",
  APPROVED: "green",
  REJECTED: "red",
};

const MOVEMENT_VARIANTS: Record<string, "gray" | "blue" | "yellow" | "purple" | "green" | "red" | "indigo" | "orange"> = {
  IN: "green",
  OUT: "orange",
  ADJUSTMENT: "blue",
};

function shortINR(value: number): string {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(0)}K`;
  return `₹${value.toLocaleString("en-IN")}`;
}

function ActivityCard({
  icon,
  title,
  href,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">{icon}</span>
          <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        </div>
        <Link
          href={href}
          className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="divide-y divide-slate-50">{children}</div>
    </div>
  );
}

function ActivityRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50/60 transition-colors">
      {children}
    </div>
  );
}

interface Props {
  activity: RecentActivity;
}

export function RecentActivityPanel({ activity }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {/* Recent Leads */}
      <ActivityCard icon={<Users className="h-4 w-4" />} title="Recent Leads" href="/crm/leads">
        {activity.leads.length === 0 ? (
          <p className="px-4 py-4 text-xs text-slate-400">No leads yet</p>
        ) : (
          activity.leads.map((lead) => (
            <ActivityRow key={lead.id}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{lead.name}</p>
                <p className="truncate text-xs text-slate-400">
                  {lead.company ?? lead.source} · {timeAgo(lead.createdAt)}
                </p>
              </div>
              <Badge variant={STAGE_VARIANTS[lead.stage] ?? "gray"}>
                {lead.stage}
              </Badge>
            </ActivityRow>
          ))
        )}
      </ActivityCard>

      {/* Recent Projects */}
      <ActivityCard icon={<Kanban className="h-4 w-4" />} title="Recent Projects" href="/projects">
        {activity.projects.length === 0 ? (
          <p className="px-4 py-4 text-xs text-slate-400">No projects yet</p>
        ) : (
          activity.projects.map((project) => (
            <ActivityRow key={project.id}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{project.name}</p>
                <p className="truncate text-xs text-slate-400">
                  {project.clientName ?? "No client"} · {timeAgo(project.createdAt)}
                </p>
              </div>
              <Badge variant={PROJECT_STATUS_VARIANTS[project.status] ?? "gray"}>
                {project.status}
              </Badge>
            </ActivityRow>
          ))
        )}
      </ActivityCard>

      {/* Recent Invoices */}
      <ActivityCard icon={<Wallet className="h-4 w-4" />} title="Recent Invoices" href="/finance/invoices">
        {activity.invoices.length === 0 ? (
          <p className="px-4 py-4 text-xs text-slate-400">No invoices yet</p>
        ) : (
          activity.invoices.map((inv) => (
            <ActivityRow key={inv.id}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {inv.invoiceNumber}
                </p>
                <p className="truncate text-xs text-slate-400">
                  {inv.clientName ?? "—"} · {shortINR(inv.totalAmount)}
                </p>
              </div>
              <Badge variant={INVOICE_STATUS_VARIANTS[inv.status] ?? "gray"}>
                {inv.status}
              </Badge>
            </ActivityRow>
          ))
        )}
      </ActivityCard>

      {/* Recent Expenses */}
      <ActivityCard icon={<ShoppingCart className="h-4 w-4" />} title="Recent Expenses" href="/finance/expenses">
        {activity.expenses.length === 0 ? (
          <p className="px-4 py-4 text-xs text-slate-400">No expenses yet</p>
        ) : (
          activity.expenses.map((exp) => (
            <ActivityRow key={exp.id}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {exp.category}
                </p>
                <p className="truncate text-xs text-slate-400">
                  {(exp.description ?? "").slice(0, 28)} · {shortINR(exp.amount)}
                </p>
              </div>
              <Badge variant={EXPENSE_STATUS_VARIANTS[exp.status] ?? "gray"}>
                {exp.status}
              </Badge>
            </ActivityRow>
          ))
        )}
      </ActivityCard>

      {/* Recent Stock Movements */}
      <ActivityCard icon={<Package className="h-4 w-4" />} title="Stock Movements" href="/products">
        {activity.stockMovements.length === 0 ? (
          <p className="px-4 py-4 text-xs text-slate-400">No movements yet</p>
        ) : (
          activity.stockMovements.map((m) => (
            <ActivityRow key={m.id}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {m.productName}
                </p>
                <p className="text-xs text-slate-400">
                  Qty: {m.quantity} · {timeAgo(m.createdAt)}
                </p>
              </div>
              <Badge variant={MOVEMENT_VARIANTS[m.type] ?? "gray"}>
                {m.type}
              </Badge>
            </ActivityRow>
          ))
        )}
      </ActivityCard>
    </div>
  );
}
