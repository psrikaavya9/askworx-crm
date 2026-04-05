import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Month helpers
// ---------------------------------------------------------------------------

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getLastNMonths(n: number): { year: number; month: number; label: string }[] {
  const now = new Date();
  const months: { year: number; month: number; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth(), label: MONTH_LABELS[d.getMonth()] });
  }
  return months;
}

function bucketByMonth<T extends { createdAt: Date | string }>(
  items: T[],
  months: { year: number; month: number }[]
): number[] {
  return months.map(({ year, month }) =>
    items.filter((item) => {
      const d = new Date(item.createdAt);
      return d.getFullYear() === year && d.getMonth() === month;
    }).length
  );
}

// ---------------------------------------------------------------------------
// Chart data types
// ---------------------------------------------------------------------------

export interface MonthlyLeadPoint {
  month: string;
  leads: number;
  converted: number;
}

export interface MonthlyFinancePoint {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}

export interface PiePoint {
  name: string;
  value: number;
  color: string;
}

export interface BarPoint {
  name: string;
  value: number;
  minimum?: number;
}

export interface ChartData {
  leadsTrend: MonthlyLeadPoint[];
  leadsBySource: PiePoint[];
  projectStatusDist: PiePoint[];
  taskStatusDist: PiePoint[];
  financeTrend: MonthlyFinancePoint[];
  inventoryByProduct: BarPoint[];
  lowStockProducts: BarPoint[];
}

// ---------------------------------------------------------------------------
// Chart data service
// ---------------------------------------------------------------------------

export async function getChartData(): Promise<ChartData> {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const months = getLastNMonths(6);

  const [
    leads,
    projectStatusGroups,
    taskStatusGroups,
    invoices,
    expenses,
    products,
  ] = await Promise.all([
    // Leads for trend + source pie
    prisma.lead.findMany({
      select: { createdAt: true, stage: true, source: true, convertedAt: true },
      where: { createdAt: { gte: sixMonthsAgo } },
    }),
    // Project status distribution
    prisma.project.groupBy({ by: ["status"], _count: { _all: true } }),
    // Task status distribution
    prisma.task.groupBy({ by: ["status"], _count: { _all: true } }),
    // Invoices for finance trend (last 6 months)
    prisma.invoice.findMany({
      select: { createdAt: true, totalAmount: true, status: true },
      where: { createdAt: { gte: sixMonthsAgo }, status: "PAID" },
    }),
    // Expenses for finance trend (last 6 months, approved)
    prisma.expense.findMany({
      select: { date: true, amount: true },
      where: {
        date: { gte: sixMonthsAgo },
        status: "APPROVED",
      },
    }),
    // All products for inventory charts
    prisma.product.findMany({
      select: { name: true, stockQuantity: true, costPrice: true, minimumStock: true },
      orderBy: { stockQuantity: "asc" },
    }),
  ]);

  // ----- Leads trend -----
  const leadCounts = bucketByMonth(leads, months);
  const convertedCounts = months.map(({ year, month }) =>
    leads.filter((l) => {
      if (!l.convertedAt) return false;
      const d = new Date(l.convertedAt);
      return d.getFullYear() === year && d.getMonth() === month;
    }).length
  );
  const leadsTrend: MonthlyLeadPoint[] = months.map((m, i) => ({
    month: m.label,
    leads: leadCounts[i],
    converted: convertedCounts[i],
  }));

  // ----- Leads by source pie -----
  const SOURCE_COLORS: Record<string, string> = {
    WEBSITE: "#6366f1",
    REFERRAL: "#22c55e",
    SOCIAL_MEDIA: "#a855f7",
    EMAIL_CAMPAIGN: "#3b82f6",
    COLD_CALL: "#f97316",
    TRADE_SHOW: "#eab308",
    PARTNER: "#14b8a6",
    OTHER: "#94a3b8",
  };
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
  // Count all-time leads by source for pie (more meaningful than 6-month window)
  const allLeadsBySource = await prisma.lead.groupBy({
    by: ["source"],
    _count: { _all: true },
  });
  const leadsBySource: PiePoint[] = allLeadsBySource
    .filter((r) => r._count._all > 0)
    .map((r) => ({
      name: SOURCE_LABELS[r.source] ?? r.source,
      value: r._count._all,
      color: SOURCE_COLORS[r.source] ?? "#94a3b8",
    }));

  // ----- Project status distribution -----
  const PROJECT_STATUS_COLORS: Record<string, string> = {
    PLANNING: "#6366f1",
    ACTIVE: "#22c55e",
    ON_HOLD: "#eab308",
    COMPLETED: "#14b8a6",
  };
  const PROJECT_STATUS_LABELS: Record<string, string> = {
    PLANNING: "Planning",
    ACTIVE: "Active",
    ON_HOLD: "On Hold",
    COMPLETED: "Completed",
  };
  const projectStatusDist: PiePoint[] = projectStatusGroups
    .filter((r) => r._count._all > 0)
    .map((r) => ({
      name: PROJECT_STATUS_LABELS[r.status] ?? r.status,
      value: r._count._all,
      color: PROJECT_STATUS_COLORS[r.status] ?? "#94a3b8",
    }));

  // ----- Task status distribution -----
  const TASK_STATUS_COLORS: Record<string, string> = {
    TODO: "#94a3b8",
    IN_PROGRESS: "#6366f1",
    DONE: "#22c55e",
  };
  const TASK_STATUS_LABELS: Record<string, string> = {
    TODO: "To Do",
    IN_PROGRESS: "In Progress",
    DONE: "Done",
  };
  const taskStatusDist: PiePoint[] = taskStatusGroups
    .filter((r) => r._count._all > 0)
    .map((r) => ({
      name: TASK_STATUS_LABELS[r.status] ?? r.status,
      value: r._count._all,
      color: TASK_STATUS_COLORS[r.status] ?? "#94a3b8",
    }));

  // ----- Finance trend -----
  const financeTrend: MonthlyFinancePoint[] = months.map(({ year, month, label }) => {
    const rev = invoices
      .filter((inv) => {
        const d = new Date(inv.createdAt);
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .reduce((sum, inv) => sum + Number(inv.totalAmount), 0);

    const exp = expenses
      .filter((e) => {
        const d = new Date(e.date);
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .reduce((sum, e) => sum + Number(e.amount), 0);

    return { month: label, revenue: rev, expenses: exp, profit: rev - exp };
  });

  // ----- Inventory by product (top 10 by value) -----
  const inventoryByProduct: BarPoint[] = products
    .map((p) => ({
      name: p.name.length > 16 ? p.name.slice(0, 14) + "…" : p.name,
      value: Math.round(p.stockQuantity * Number(p.costPrice)),
      minimum: p.minimumStock,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // ----- Low stock products -----
  const lowStockProducts: BarPoint[] = products
    .filter((p) => p.stockQuantity <= p.minimumStock)
    .map((p) => ({
      name: p.name.length > 16 ? p.name.slice(0, 14) + "…" : p.name,
      value: p.stockQuantity,
      minimum: p.minimumStock,
    }));

  return {
    leadsTrend,
    leadsBySource,
    projectStatusDist,
    taskStatusDist,
    financeTrend,
    inventoryByProduct,
    lowStockProducts,
  };
}

// ---------------------------------------------------------------------------
// Recent activity types & service
// ---------------------------------------------------------------------------

export interface RecentLead {
  id: string;
  name: string;
  company: string | null;
  stage: string;
  source: string;
  createdAt: string;
}

export interface RecentProject {
  id: string;
  name: string;
  status: string;
  clientName: string | null;
  createdAt: string;
}

export interface RecentInvoice {
  id: string;
  invoiceNumber: string;
  clientName: string | null;
  totalAmount: number;
  status: string;
  createdAt: string;
}

export interface RecentExpense {
  id: string;
  category: string;
  description: string | null;
  amount: number;
  status: string;
  createdAt: string;
}

export interface RecentStockMovement {
  id: string;
  productName: string;
  type: string;
  quantity: number;
  createdAt: string;
}

export interface RecentActivity {
  leads: RecentLead[];
  projects: RecentProject[];
  invoices: RecentInvoice[];
  expenses: RecentExpense[];
  stockMovements: RecentStockMovement[];
}

export async function getRecentActivity(): Promise<RecentActivity> {
  const [leads, projects, invoices, expenses, stockMovements] = await Promise.all([
    prisma.lead.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        company: true,
        stage: true,
        source: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.project.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        client: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.invoice.findMany({
      select: {
        id: true,
        invoiceNumber: true,
        totalAmount: true,
        status: true,
        createdAt: true,
        client: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.expense.findMany({
      select: {
        id: true,
        category: true,
        description: true,
        amount: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.stockMovement.findMany({
      select: {
        id: true,
        type: true,
        quantity: true,
        createdAt: true,
        product: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return {
    leads: leads.map((l) => ({
      id: l.id,
      name: `${l.firstName} ${l.lastName}`,
      company: l.company,
      stage: l.stage,
      source: l.source,
      createdAt: l.createdAt.toISOString(),
    })),
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      clientName: p.client ? `${p.client.firstName} ${p.client.lastName}` : null,
      createdAt: p.createdAt.toISOString(),
    })),
    invoices: invoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      clientName: inv.client ? `${inv.client.firstName} ${inv.client.lastName}` : null,
      totalAmount: Number(inv.totalAmount),
      status: inv.status,
      createdAt: inv.createdAt.toISOString(),
    })),
    expenses: expenses.map((e) => ({
      id: e.id,
      category: e.category,
      description: e.description,
      amount: Number(e.amount),
      status: e.status,
      createdAt: e.createdAt.toISOString(),
    })),
    stockMovements: stockMovements.map((m) => ({
      id: m.id,
      productName: m.product.name,
      type: m.type,
      quantity: m.quantity,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}
