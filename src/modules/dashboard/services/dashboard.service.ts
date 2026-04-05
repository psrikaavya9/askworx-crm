import { getCRMDashboardKPI } from "@/modules/crm/services/kpi.service";
import { getProjectKPIs } from "@/modules/projects/services/project.service";
import { getAttendanceKPI } from "@/modules/staff/services/attendance.service";
import { getFinanceKPI } from "@/modules/finance/services/expense.service";
import { getInventoryKPI } from "@/modules/inventory/services/stock.service";

// ---------------------------------------------------------------------------
// Dashboard KPI types
// ---------------------------------------------------------------------------

export interface DashboardCRMKPI {
  totalLeads: number;
  leadsThisMonth: number;
  qualifiedLeads: number;
  convertedClients: number;
  conversionRate: number;
  avgDealValue: number;
  pipelineValue: number;
  wonLeads: number;
  overdueFollowUps: number;
  leadsBySource: {
    source: string;
    label: string;
    total: number;
    won: number;
    conversionRate: number;
  }[];
  leadsByStage: {
    stage: string;
    label: string;
    count: number;
    totalValue: number;
  }[];
}

export interface DashboardProjectsKPI {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  delayedProjects: number;
  projectCompletionRate: number;
  tasksCompleted: number;
  tasksPending: number;
  totalHoursLogged: number;
}

export interface DashboardStaffKPI {
  totalStaff: number;
  presentToday: number;
  absentToday: number;
  lateCheckIns: number;
  attendanceRate: number;
}

export interface DashboardFinanceKPI {
  totalRevenue: number;
  totalInvoices: number;
  paidInvoices: number;
  outstandingInvoices: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
  averageInvoiceValue: number;
  overdueInvoices: number;
}

export interface DashboardInventoryKPI {
  totalProducts: number;
  lowStockItems: number;
  inventoryValue: number;
  recentStockMovements: number;
}

export interface AllKPIs {
  crm: DashboardCRMKPI;
  projects: DashboardProjectsKPI;
  staff: DashboardStaffKPI;
  finance: DashboardFinanceKPI;
  inventory: DashboardInventoryKPI;
}

// ---------------------------------------------------------------------------
// Individual KPI getters
// ---------------------------------------------------------------------------

export async function getCRMKPIs(): Promise<DashboardCRMKPI> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const kpi = await getCRMDashboardKPI(startOfMonth, now);

  const qualifiedLeads =
    kpi.pipeline.find((p) => p.stage === "QUALIFIED")?.count ?? 0;
  const wonLeads =
    kpi.pipeline.find((p) => p.stage === "WON")?.count ?? 0;

  return {
    totalLeads: kpi.totalLeads,
    leadsThisMonth: kpi.newThisPeriod,
    qualifiedLeads,
    convertedClients: kpi.wonThisPeriod,
    conversionRate: kpi.overallConversionRate,
    avgDealValue: kpi.avgDealValue,
    pipelineValue: kpi.totalPipelineValue,
    wonLeads,
    overdueFollowUps: kpi.overdueReminders,
    leadsBySource: kpi.bySource.map((s) => ({
      source: s.source,
      label: s.label,
      total: s.total,
      won: s.won,
      conversionRate: s.conversionRate,
    })),
    leadsByStage: kpi.pipeline.map((p) => ({
      stage: p.stage,
      label: p.label,
      count: p.count,
      totalValue: p.totalValue,
    })),
  };
}

export async function getProjectKPIsForDashboard(): Promise<DashboardProjectsKPI> {
  const kpi = await getProjectKPIs();

  const completedProjects = kpi.byStatus.COMPLETED;
  const projectCompletionRate =
    kpi.totalProjects > 0
      ? Math.round((completedProjects / kpi.totalProjects) * 100 * 10) / 10
      : 0;

  return {
    totalProjects: kpi.totalProjects,
    activeProjects: kpi.byStatus.ACTIVE,
    completedProjects,
    delayedProjects: kpi.overdueProjects,
    projectCompletionRate,
    tasksCompleted: kpi.tasksByStatus.DONE,
    tasksPending: kpi.tasksByStatus.TODO + kpi.tasksByStatus.IN_PROGRESS,
    totalHoursLogged: kpi.totalHoursLogged,
  };
}

export async function getStaffKPIsForDashboard(): Promise<DashboardStaffKPI> {
  const kpi = await getAttendanceKPI();

  const attendanceRate =
    kpi.totalStaff > 0
      ? Math.round(
          ((kpi.presentToday + kpi.lateToday) / kpi.totalStaff) * 100 * 10
        ) / 10
      : 0;

  return {
    totalStaff: kpi.totalStaff,
    presentToday: kpi.presentToday,
    absentToday: kpi.absentToday,
    lateCheckIns: kpi.lateToday,
    attendanceRate,
  };
}

export async function getFinanceKPIsForDashboard(): Promise<DashboardFinanceKPI> {
  const kpi = await getFinanceKPI();

  const profitMargin =
    kpi.totalRevenue > 0
      ? Math.round((kpi.netProfit / kpi.totalRevenue) * 100 * 10) / 10
      : 0;

  const averageInvoiceValue =
    kpi.paidInvoicesCount > 0
      ? Math.round(kpi.totalRevenue / kpi.paidInvoicesCount)
      : 0;

  return {
    totalRevenue: kpi.totalRevenue,
    totalInvoices: kpi.totalInvoicesCount,
    paidInvoices: kpi.paidInvoicesCount,
    outstandingInvoices: kpi.outstandingInvoices,
    totalExpenses: kpi.totalExpenses,
    netProfit: kpi.netProfit,
    profitMargin,
    averageInvoiceValue,
    overdueInvoices: kpi.overdueInvoicesCount,
  };
}

export async function getInventoryKPIsForDashboard(): Promise<DashboardInventoryKPI> {
  const kpi = await getInventoryKPI();

  return {
    totalProducts: kpi.totalProducts,
    lowStockItems: kpi.lowStockItems,
    inventoryValue: kpi.totalInventoryValue,
    recentStockMovements: kpi.recentMovementsCount,
  };
}

// ---------------------------------------------------------------------------
// Aggregate — all modules in parallel
// ---------------------------------------------------------------------------

export async function getAllKPIs(): Promise<AllKPIs> {
  const [crm, projects, staff, finance, inventory] = await Promise.all([
    getCRMKPIs(),
    getProjectKPIsForDashboard(),
    getStaffKPIsForDashboard(),
    getFinanceKPIsForDashboard(),
    getInventoryKPIsForDashboard(),
  ]);

  return { crm, projects, staff, finance, inventory };
}
