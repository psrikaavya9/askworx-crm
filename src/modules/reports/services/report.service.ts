import { prisma } from "@/lib/prisma";
import type { ReportFilters, ReportResult } from "../types";
import type {
  LeadFunnelRow,
  LeadsBySourceRow,
  LeadConversionRow,
  ProjectStatusRow,
  ProjectCompletionRow,
  TaskCompletionRow,
  AttendanceReportRow,
  LateCheckInRow,
  StaffUtilizationRow,
  RevenueReportRow,
  ExpenseReportRow,
  ProfitLossRow,
  OutstandingInvoiceRow,
  StockMovementReportRow,
  LowStockRow,
  InventoryValuationRow,
} from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STAGE_LABELS: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  PROPOSAL: "Proposal Sent",
  WON: "Won",
  LOST: "Lost",
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

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function parseDateRange(filters: ReportFilters) {
  const startDate = filters.startDate ? new Date(filters.startDate) : undefined;
  const endDate = filters.endDate
    ? new Date(new Date(filters.endDate).setHours(23, 59, 59, 999))
    : undefined;
  return { startDate, endDate };
}

function diffDays(a: Date, b: Date): number {
  return Math.round(Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function calcHoursWorked(checkIn: Date | null, checkOut: Date | null): number | null {
  if (!checkIn || !checkOut) return null;
  return Math.round(((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60)) * 10) / 10;
}

function countWeekdays(start: Date, end: Date): number {
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

// ---------------------------------------------------------------------------
// CRM Reports
// ---------------------------------------------------------------------------

export async function getLeadFunnelReport(
  filters: ReportFilters
): Promise<ReportResult<LeadFunnelRow>> {
  const { startDate, endDate } = parseDateRange(filters);
  const where = startDate || endDate
    ? { createdAt: { ...(startDate && { gte: startDate }), ...(endDate && { lte: endDate }) } }
    : {};

  const leads = await prisma.lead.findMany({
    select: { stage: true, dealValue: true },
    where,
  });

  const total = leads.length;
  const stageOrder = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"];
  const rows: LeadFunnelRow[] = stageOrder.map((stage) => {
    const stageLeads = leads.filter((l) => l.stage === stage);
    const count = stageLeads.length;
    const totalValue = stageLeads.reduce((s, l) => s + Number(l.dealValue ?? 0), 0);
    return {
      stage,
      label: STAGE_LABELS[stage] ?? stage,
      count,
      totalValue,
      avgDealValue: count > 0 ? Math.round(totalValue / count) : 0,
      pct: total > 0 ? Math.round((count / total) * 100 * 10) / 10 : 0,
    };
  });

  const totalValue = leads.reduce((s, l) => s + Number(l.dealValue ?? 0), 0);

  return {
    data: rows,
    total: rows.length,
    generatedAt: new Date().toISOString(),
    summary: {
      totalLeads: total,
      wonLeads: rows.find((r) => r.stage === "WON")?.count ?? 0,
      totalPipelineValue: Math.round(totalValue),
    },
  };
}

export async function getLeadsBySourceReport(
  filters: ReportFilters
): Promise<ReportResult<LeadsBySourceRow>> {
  const { startDate, endDate } = parseDateRange(filters);
  const where = startDate || endDate
    ? { createdAt: { ...(startDate && { gte: startDate }), ...(endDate && { lte: endDate }) } }
    : {};

  const leads = await prisma.lead.findMany({
    select: { source: true, stage: true, dealValue: true },
    where,
  });

  const sources = [...new Set(leads.map((l) => l.source))];
  const rows: LeadsBySourceRow[] = sources.map((source) => {
    const srcLeads = leads.filter((l) => l.source === source);
    const won = srcLeads.filter((l) => l.stage === "WON");
    const lost = srcLeads.filter((l) => l.stage === "LOST");
    const active = srcLeads.filter((l) => l.stage !== "WON" && l.stage !== "LOST");
    const totalValue = won.reduce((s, l) => s + Number(l.dealValue ?? 0), 0);
    return {
      source,
      label: SOURCE_LABELS[source] ?? source,
      total: srcLeads.length,
      won: won.length,
      lost: lost.length,
      active: active.length,
      wonRate: srcLeads.length > 0
        ? Math.round((won.length / srcLeads.length) * 100 * 10) / 10
        : 0,
      totalValue,
    };
  }).sort((a, b) => b.total - a.total);

  return {
    data: rows,
    total: rows.length,
    generatedAt: new Date().toISOString(),
    summary: {
      totalLeads: leads.length,
      totalSources: rows.length,
      bestSource: rows[0]?.label ?? "—",
    },
  };
}

export async function getLeadConversionReport(
  filters: ReportFilters
): Promise<ReportResult<LeadConversionRow>> {
  const { startDate, endDate } = parseDateRange(filters);
  const where: Record<string, unknown> = { stage: "WON", convertedAt: { not: null } };
  if (startDate || endDate) {
    where.convertedAt = {
      ...(startDate && { gte: startDate }),
      ...(endDate && { lte: endDate }),
    };
  }

  const leads = await prisma.lead.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      company: true,
      source: true,
      createdAt: true,
      convertedAt: true,
      dealValue: true,
    },
    where,
    orderBy: { convertedAt: "desc" },
  });

  const rows: LeadConversionRow[] = leads.map((l) => ({
    id: l.id,
    name: `${l.firstName} ${l.lastName}`,
    company: l.company,
    source: SOURCE_LABELS[l.source] ?? l.source,
    createdAt: l.createdAt.toISOString(),
    convertedAt: l.convertedAt!.toISOString(),
    daysToConvert: diffDays(l.createdAt, l.convertedAt!),
    dealValue: Number(l.dealValue ?? 0),
  }));

  const avgDays =
    rows.length > 0
      ? Math.round(rows.reduce((s, r) => s + r.daysToConvert, 0) / rows.length)
      : 0;

  return {
    data: rows,
    total: rows.length,
    generatedAt: new Date().toISOString(),
    summary: {
      converted: rows.length,
      avgDaysToConvert: avgDays,
      totalRevenue: Math.round(rows.reduce((s, r) => s + r.dealValue, 0)),
    },
  };
}

// ---------------------------------------------------------------------------
// Project Reports
// ---------------------------------------------------------------------------

export async function getProjectStatusReport(
  filters: ReportFilters
): Promise<ReportResult<ProjectStatusRow>> {
  const where: Record<string, unknown> = {};
  if (filters.status) where.status = filters.status;

  const projects = await prisma.project.findMany({
    where,
    select: {
      id: true,
      name: true,
      status: true,
      deadline: true,
      createdAt: true,
      client: { select: { firstName: true, lastName: true } },
      tasks: { select: { status: true, hoursLogged: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows: ProjectStatusRow[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    clientName: p.client ? `${p.client.firstName} ${p.client.lastName}` : null,
    taskCount: p.tasks.length,
    doneTasks: p.tasks.filter((t) => t.status === "DONE").length,
    deadline: p.deadline?.toISOString() ?? null,
    hoursLogged: p.tasks.reduce((s, t) => s + Number(t.hoursLogged), 0),
    createdAt: p.createdAt.toISOString(),
  }));

  const byStatus = rows.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    data: rows,
    total: rows.length,
    generatedAt: new Date().toISOString(),
    summary: {
      total: rows.length,
      active: byStatus["ACTIVE"] ?? 0,
      completed: byStatus["COMPLETED"] ?? 0,
      delayed: rows.filter(
        (r) => r.deadline && new Date(r.deadline) < new Date() && r.status !== "COMPLETED"
      ).length,
    },
  };
}

export async function getProjectCompletionReport(
  filters: ReportFilters
): Promise<ReportResult<ProjectCompletionRow>> {
  const { startDate, endDate } = parseDateRange(filters);
  const where: Record<string, unknown> = {};
  if (startDate || endDate) {
    where.updatedAt = {
      ...(startDate && { gte: startDate }),
      ...(endDate && { lte: endDate }),
    };
  }

  const projects = await prisma.project.findMany({
    where,
    select: {
      id: true,
      name: true,
      status: true,
      startDate: true,
      deadline: true,
      client: { select: { firstName: true, lastName: true } },
      tasks: { select: { status: true, hoursLogged: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const rows: ProjectCompletionRow[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    clientName: p.client ? `${p.client.firstName} ${p.client.lastName}` : null,
    startDate: p.startDate?.toISOString() ?? null,
    deadline: p.deadline?.toISOString() ?? null,
    totalTasks: p.tasks.length,
    doneTasks: p.tasks.filter((t) => t.status === "DONE").length,
    hoursLogged: p.tasks.reduce((s, t) => s + Number(t.hoursLogged), 0),
    status: p.status,
  }));

  const completedCount = rows.filter((r) => r.status === "COMPLETED").length;
  const completionRate =
    rows.length > 0 ? Math.round((completedCount / rows.length) * 100) : 0;

  return {
    data: rows,
    total: rows.length,
    generatedAt: new Date().toISOString(),
    summary: {
      total: rows.length,
      completed: completedCount,
      completionRate: `${completionRate}%`,
      totalHours: Math.round(rows.reduce((s, r) => s + r.hoursLogged, 0)),
    },
  };
}

export async function getTaskCompletionReport(
  filters: ReportFilters
): Promise<ReportResult<TaskCompletionRow>> {
  const where: Record<string, unknown> = {};
  if (filters.projectId) where.projectId = filters.projectId;
  if (filters.status) where.status = filters.status;

  const tasks = await prisma.task.findMany({
    where,
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      dueDate: true,
      hoursLogged: true,
      createdAt: true,
      project: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows: TaskCompletionRow[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    projectName: t.project.name,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate?.toISOString() ?? null,
    hoursLogged: Number(t.hoursLogged),
    createdAt: t.createdAt.toISOString(),
  }));

  const doneCount = rows.filter((r) => r.status === "DONE").length;

  return {
    data: rows,
    total: rows.length,
    generatedAt: new Date().toISOString(),
    summary: {
      total: rows.length,
      done: doneCount,
      pending: rows.length - doneCount,
      completionRate: `${rows.length > 0 ? Math.round((doneCount / rows.length) * 100) : 0}%`,
      totalHours: Math.round(rows.reduce((s, r) => s + r.hoursLogged, 0)),
    },
  };
}

// ---------------------------------------------------------------------------
// Staff Reports
// ---------------------------------------------------------------------------

export async function getAttendanceReport(
  filters: ReportFilters
): Promise<ReportResult<AttendanceReportRow>> {
  const { startDate, endDate } = parseDateRange(filters);
  const where: Record<string, unknown> = {};
  if (filters.staffId) where.staffId = filters.staffId;
  if (startDate || endDate) {
    where.date = {
      ...(startDate && { gte: startDate }),
      ...(endDate && { lte: endDate }),
    };
  }

  const records = await prisma.attendance.findMany({
    where,
    include: {
      staff: { select: { firstName: true, lastName: true, department: true } },
    },
    orderBy: [{ date: "desc" }, { staff: { lastName: "asc" } }],
  });

  const rows: AttendanceReportRow[] = records.map((r) => ({
    staffId: r.staffId,
    staffName: `${r.staff.firstName} ${r.staff.lastName}`,
    department: r.staff.department,
    date: r.date.toISOString(),
    checkInTime: r.checkInTime?.toISOString() ?? null,
    checkOutTime: r.checkOutTime?.toISOString() ?? null,
    status: r.attendanceStatus,
    hoursWorked: calcHoursWorked(r.checkInTime, r.checkOutTime),
  }));

  const present = rows.filter((r) => r.status === "PRESENT").length;
  const late = rows.filter((r) => r.status === "LATE").length;

  return {
    data: rows,
    total: rows.length,
    generatedAt: new Date().toISOString(),
    summary: {
      totalRecords: rows.length,
      present,
      late,
      absent: rows.filter((r) => r.status === "ABSENT").length,
    },
  };
}

export async function getLateCheckInsReport(
  filters: ReportFilters
): Promise<ReportResult<LateCheckInRow>> {
  const { startDate, endDate } = parseDateRange(filters);
  const where: Record<string, unknown> = { attendanceStatus: "LATE" };
  if (filters.staffId) where.staffId = filters.staffId;
  if (startDate || endDate) {
    where.date = {
      ...(startDate && { gte: startDate }),
      ...(endDate && { lte: endDate }),
    };
  }

  const records = await prisma.attendance.findMany({
    where,
    include: {
      staff: { select: { firstName: true, lastName: true, role: true, department: true } },
    },
    orderBy: { date: "desc" },
  });

  const rows: LateCheckInRow[] = records.map((r) => ({
    staffName: `${r.staff.firstName} ${r.staff.lastName}`,
    role: r.staff.role,
    department: r.staff.department,
    date: r.date.toISOString(),
    checkInTime: r.checkInTime?.toISOString() ?? r.date.toISOString(),
  }));

  return {
    data: rows,
    total: rows.length,
    generatedAt: new Date().toISOString(),
    summary: {
      totalLate: rows.length,
    },
  };
}

export async function getStaffUtilizationReport(
  filters: ReportFilters
): Promise<ReportResult<StaffUtilizationRow>> {
  const { startDate, endDate } = parseDateRange(filters);
  const rangeStart = startDate ?? new Date(new Date().setDate(new Date().getDate() - 29));
  const rangeEnd = endDate ?? new Date();
  const totalDays = countWeekdays(rangeStart, rangeEnd);

  const attendanceWhere: Record<string, unknown> = {
    date: { gte: rangeStart, lte: rangeEnd },
  };

  const [staffList, attendanceRecords] = await Promise.all([
    prisma.staff.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, firstName: true, lastName: true, role: true, department: true },
    }),
    prisma.attendance.findMany({
      where: attendanceWhere,
      select: { staffId: true, attendanceStatus: true },
    }),
  ]);

  const rows: StaffUtilizationRow[] = staffList.map((staff) => {
    const staffAttendance = attendanceRecords.filter((a) => a.staffId === staff.id);
    const present = staffAttendance.filter((a) => a.attendanceStatus === "PRESENT").length;
    const late = staffAttendance.filter((a) => a.attendanceStatus === "LATE").length;
    const attended = present + late;
    const absent = Math.max(0, totalDays - attended);
    return {
      staffId: staff.id,
      staffName: `${staff.firstName} ${staff.lastName}`,
      role: staff.role,
      department: staff.department,
      totalDays,
      present,
      late,
      absent,
      attendanceRate: totalDays > 0 ? Math.round((attended / totalDays) * 100 * 10) / 10 : 0,
    };
  });

  rows.sort((a, b) => b.attendanceRate - a.attendanceRate);

  const avgRate =
    rows.length > 0
      ? Math.round(rows.reduce((s, r) => s + r.attendanceRate, 0) / rows.length * 10) / 10
      : 0;

  return {
    data: rows,
    total: rows.length,
    generatedAt: new Date().toISOString(),
    summary: {
      totalStaff: rows.length,
      avgAttendanceRate: `${avgRate}%`,
      periodDays: totalDays,
    },
  };
}

// ---------------------------------------------------------------------------
// Finance Reports
// ---------------------------------------------------------------------------

export async function getRevenueReport(
  filters: ReportFilters
): Promise<ReportResult<RevenueReportRow>> {
  const { startDate, endDate } = parseDateRange(filters);
  const where: Record<string, unknown> = {};
  if (filters.status) {
    where.status = filters.status;
  } else {
    where.status = "PAID";
  }
  if (startDate || endDate) {
    where.issueDate = {
      ...(startDate && { gte: startDate }),
      ...(endDate && { lte: endDate }),
    };
  }

  const invoices = await prisma.invoice.findMany({
    where,
    select: {
      invoiceNumber: true,
      issueDate: true,
      dueDate: true,
      subtotal: true,
      totalTax: true,
      totalAmount: true,
      status: true,
      client: { select: { firstName: true, lastName: true } },
    },
    orderBy: { issueDate: "desc" },
  });

  const rows: RevenueReportRow[] = invoices.map((inv) => ({
    invoiceNumber: inv.invoiceNumber,
    clientName: inv.client ? `${inv.client.firstName} ${inv.client.lastName}` : null,
    issueDate: inv.issueDate.toISOString(),
    dueDate: inv.dueDate.toISOString(),
    subtotal: Number(inv.subtotal),
    totalTax: Number(inv.totalTax),
    totalAmount: Number(inv.totalAmount),
    status: inv.status,
  }));

  const totalRevenue = rows.reduce((s, r) => s + r.totalAmount, 0);
  const totalTax = rows.reduce((s, r) => s + r.totalTax, 0);

  return {
    data: rows,
    total: rows.length,
    generatedAt: new Date().toISOString(),
    summary: {
      invoiceCount: rows.length,
      totalRevenue: Math.round(totalRevenue),
      totalTax: Math.round(totalTax),
      avgInvoiceValue: rows.length > 0 ? Math.round(totalRevenue / rows.length) : 0,
    },
  };
}

export async function getExpenseReport(
  filters: ReportFilters
): Promise<ReportResult<ExpenseReportRow>> {
  const { startDate, endDate } = parseDateRange(filters);
  const where: Record<string, unknown> = {};
  if (filters.staffId) where.staffId = filters.staffId;
  if (filters.status) where.status = filters.status;
  if (filters.category) where.category = { contains: filters.category, mode: "insensitive" };
  if (startDate || endDate) {
    where.date = {
      ...(startDate && { gte: startDate }),
      ...(endDate && { lte: endDate }),
    };
  }

  const expenses = await prisma.expense.findMany({
    where,
    include: {
      staff: { select: { firstName: true, lastName: true } },
    },
    orderBy: { date: "desc" },
  });

  const rows: ExpenseReportRow[] = expenses.map((e) => ({
    id: e.id,
    category: e.category,
    description: e.description,
    amount: Number(e.amount),
    date: e.date.toISOString(),
    staffName: e.staff ? `${e.staff.firstName} ${e.staff.lastName}` : null,
    status: e.status,
  }));

  const totalAmount = rows.reduce((s, r) => s + r.amount, 0);

  const byCategory = rows.reduce((acc, r) => {
    acc[r.category] = (acc[r.category] ?? 0) + r.amount;
    return acc;
  }, {} as Record<string, number>);
  const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  return {
    data: rows,
    total: rows.length,
    generatedAt: new Date().toISOString(),
    summary: {
      totalExpenses: Math.round(totalAmount),
      expenseCount: rows.length,
      topCategory,
      avgExpense: rows.length > 0 ? Math.round(totalAmount / rows.length) : 0,
    },
  };
}

export async function getProfitLossReport(
  filters: ReportFilters
): Promise<ReportResult<ProfitLossRow>> {
  const { startDate, endDate } = parseDateRange(filters);

  // Build last 12 months if no range given
  const now = new Date();
  const rangeEnd = endDate ?? now;
  const rangeStart =
    startDate ?? new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const [invoices, expenses] = await Promise.all([
    prisma.invoice.findMany({
      where: { status: "PAID", issueDate: { gte: rangeStart, lte: rangeEnd } },
      select: { issueDate: true, totalAmount: true },
    }),
    prisma.expense.findMany({
      where: {
        status: "APPROVED",
        date: { gte: rangeStart, lte: rangeEnd },
      },
      select: { date: true, amount: true },
    }),
  ]);

  // Build monthly buckets
  const months: { year: number; month: number; label: string }[] = [];
  const cur = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
  while (cur <= rangeEnd) {
    months.push({ year: cur.getFullYear(), month: cur.getMonth(), label: `${MONTH_LABELS[cur.getMonth()]} ${cur.getFullYear()}` });
    cur.setMonth(cur.getMonth() + 1);
  }

  const rows: ProfitLossRow[] = months.map(({ year, month, label }) => {
    const revenue = invoices
      .filter((inv) => {
        const d = new Date(inv.issueDate);
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .reduce((s, inv) => s + Number(inv.totalAmount), 0);

    const expAmt = expenses
      .filter((e) => {
        const d = new Date(e.date);
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .reduce((s, e) => s + Number(e.amount), 0);

    const profit = revenue - expAmt;
    return {
      period: label,
      revenue: Math.round(revenue),
      expenses: Math.round(expAmt),
      profit: Math.round(profit),
      margin: revenue > 0 ? Math.round((profit / revenue) * 100 * 10) / 10 : 0,
    };
  });

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalExpenses = rows.reduce((s, r) => s + r.expenses, 0);
  const totalProfit = totalRevenue - totalExpenses;

  return {
    data: rows,
    total: rows.length,
    generatedAt: new Date().toISOString(),
    summary: {
      totalRevenue: Math.round(totalRevenue),
      totalExpenses: Math.round(totalExpenses),
      totalProfit: Math.round(totalProfit),
      overallMargin: `${totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100 * 10) / 10 : 0}%`,
    },
  };
}

export async function getOutstandingInvoicesReport(
  filters: ReportFilters
): Promise<ReportResult<OutstandingInvoiceRow>> {
  const now = new Date();
  const where: Record<string, unknown> = { status: { in: ["SENT", "OVERDUE"] } };
  if (filters.status) where.status = filters.status;

  const invoices = await prisma.invoice.findMany({
    where,
    select: {
      invoiceNumber: true,
      issueDate: true,
      dueDate: true,
      totalAmount: true,
      status: true,
      client: { select: { firstName: true, lastName: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  const rows: OutstandingInvoiceRow[] = invoices.map((inv) => ({
    invoiceNumber: inv.invoiceNumber,
    clientName: inv.client ? `${inv.client.firstName} ${inv.client.lastName}` : null,
    issueDate: inv.issueDate.toISOString(),
    dueDate: inv.dueDate.toISOString(),
    totalAmount: Number(inv.totalAmount),
    status: inv.status,
    daysOverdue: Math.max(0, diffDays(inv.dueDate, now) * (inv.dueDate < now ? 1 : -1)),
  }));

  const totalOutstanding = rows.reduce((s, r) => s + r.totalAmount, 0);
  const overdueCount = rows.filter((r) => r.status === "OVERDUE").length;

  return {
    data: rows,
    total: rows.length,
    generatedAt: new Date().toISOString(),
    summary: {
      totalOutstanding: Math.round(totalOutstanding),
      overdueCount,
      sentCount: rows.length - overdueCount,
    },
  };
}

// ---------------------------------------------------------------------------
// Inventory Reports
// ---------------------------------------------------------------------------

export async function getStockMovementReport(
  filters: ReportFilters
): Promise<ReportResult<StockMovementReportRow>> {
  const { startDate, endDate } = parseDateRange(filters);
  const where: Record<string, unknown> = {};
  if (filters.type) where.type = filters.type;
  if (startDate || endDate) {
    where.createdAt = {
      ...(startDate && { gte: startDate }),
      ...(endDate && { lte: endDate }),
    };
  }

  const movements = await prisma.stockMovement.findMany({
    where,
    include: {
      product: { select: { name: true, sku: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows: StockMovementReportRow[] = movements.map((m) => ({
    productName: m.product.name,
    sku: m.product.sku,
    type: m.type,
    quantity: m.quantity,
    reference: m.reference,
    notes: m.notes,
    date: m.createdAt.toISOString(),
  }));

  const inQty = rows.filter((r) => r.type === "IN").reduce((s, r) => s + r.quantity, 0);
  const outQty = rows.filter((r) => r.type === "OUT").reduce((s, r) => s + r.quantity, 0);

  return {
    data: rows,
    total: rows.length,
    generatedAt: new Date().toISOString(),
    summary: {
      totalMovements: rows.length,
      totalIn: inQty,
      totalOut: outQty,
      net: inQty - outQty,
    },
  };
}

export async function getLowStockReport(
  filters: ReportFilters
): Promise<ReportResult<LowStockRow>> {
  const where: Record<string, unknown> = {};
  if (filters.category) where.category = { contains: filters.category, mode: "insensitive" };

  const products = await prisma.product.findMany({
    where,
    select: {
      name: true,
      sku: true,
      category: true,
      stockQuantity: true,
      minimumStock: true,
      costPrice: true,
    },
    orderBy: { stockQuantity: "asc" },
  });

  const rows: LowStockRow[] = products
    .filter((p) => p.stockQuantity <= p.minimumStock)
    .map((p) => ({
      name: p.name,
      sku: p.sku,
      category: p.category,
      stockQuantity: p.stockQuantity,
      minimumStock: p.minimumStock,
      deficit: Math.max(0, p.minimumStock - p.stockQuantity),
      costValue: p.stockQuantity * Number(p.costPrice),
    }));

  return {
    data: rows,
    total: rows.length,
    generatedAt: new Date().toISOString(),
    summary: {
      lowStockItems: rows.length,
      outOfStock: rows.filter((r) => r.stockQuantity === 0).length,
      totalDeficit: rows.reduce((s, r) => s + r.deficit, 0),
    },
  };
}

export async function getInventoryValuationReport(
  filters: ReportFilters
): Promise<ReportResult<InventoryValuationRow>> {
  const where: Record<string, unknown> = {};
  if (filters.category) where.category = { contains: filters.category, mode: "insensitive" };

  const products = await prisma.product.findMany({
    where,
    select: {
      name: true,
      sku: true,
      category: true,
      stockQuantity: true,
      costPrice: true,
      unitPrice: true,
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  const rows: InventoryValuationRow[] = products.map((p) => {
    const cost = Number(p.costPrice);
    const price = Number(p.unitPrice);
    const costValue = p.stockQuantity * cost;
    const saleValue = p.stockQuantity * price;
    const grossMargin = price > 0 ? Math.round(((price - cost) / price) * 100 * 10) / 10 : 0;
    return {
      name: p.name,
      sku: p.sku,
      category: p.category,
      stockQuantity: p.stockQuantity,
      costPrice: cost,
      unitPrice: price,
      costValue,
      saleValue,
      grossMargin,
    };
  });

  const totalCostValue = rows.reduce((s, r) => s + r.costValue, 0);
  const totalSaleValue = rows.reduce((s, r) => s + r.saleValue, 0);

  return {
    data: rows,
    total: rows.length,
    generatedAt: new Date().toISOString(),
    summary: {
      totalProducts: rows.length,
      totalCostValue: Math.round(totalCostValue),
      totalSaleValue: Math.round(totalSaleValue),
      potentialProfit: Math.round(totalSaleValue - totalCostValue),
    },
  };
}
