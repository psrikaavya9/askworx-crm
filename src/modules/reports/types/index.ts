// ---------------------------------------------------------------------------
// Report filter input
// ---------------------------------------------------------------------------

export interface ReportFilters {
  startDate?: string;
  endDate?: string;
  staffId?: string;
  projectId?: string;
  status?: string;
  type?: string;
  category?: string;
}

// ---------------------------------------------------------------------------
// CRM report rows
// ---------------------------------------------------------------------------

export interface LeadFunnelRow {
  stage: string;
  label: string;
  count: number;
  totalValue: number;
  avgDealValue: number;
  pct: number; // % of total leads
}

export interface LeadsBySourceRow {
  source: string;
  label: string;
  total: number;
  won: number;
  lost: number;
  active: number;
  wonRate: number;
  totalValue: number;
}

export interface LeadConversionRow {
  id: string;
  name: string;
  company: string | null;
  source: string;
  createdAt: string;
  convertedAt: string;
  daysToConvert: number;
  dealValue: number;
}

// ---------------------------------------------------------------------------
// Project report rows
// ---------------------------------------------------------------------------

export interface ProjectStatusRow {
  id: string;
  name: string;
  status: string;
  clientName: string | null;
  taskCount: number;
  doneTasks: number;
  deadline: string | null;
  hoursLogged: number;
  createdAt: string;
}

export interface ProjectCompletionRow {
  id: string;
  name: string;
  clientName: string | null;
  startDate: string | null;
  deadline: string | null;
  totalTasks: number;
  doneTasks: number;
  hoursLogged: number;
  status: string;
}

export interface TaskCompletionRow {
  id: string;
  title: string;
  projectName: string;
  status: string;
  priority: string;
  dueDate: string | null;
  hoursLogged: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Staff report rows
// ---------------------------------------------------------------------------

export interface AttendanceReportRow {
  staffId: string;
  staffName: string;
  department: string | null;
  date: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  status: string;
  hoursWorked: number | null;
}

export interface LateCheckInRow {
  staffName: string;
  role: string;
  department: string | null;
  date: string;
  checkInTime: string;
}

export interface StaffUtilizationRow {
  staffId: string;
  staffName: string;
  role: string;
  department: string | null;
  totalDays: number;
  present: number;
  late: number;
  absent: number;
  attendanceRate: number;
}

// ---------------------------------------------------------------------------
// Finance report rows
// ---------------------------------------------------------------------------

export interface RevenueReportRow {
  invoiceNumber: string;
  clientName: string | null;
  issueDate: string;
  dueDate: string;
  subtotal: number;
  totalTax: number;
  totalAmount: number;
  status: string;
}

export interface ExpenseReportRow {
  id: string;
  category: string;
  description: string | null;
  amount: number;
  date: string;
  staffName: string | null;
  status: string;
}

export interface ProfitLossRow {
  period: string;
  revenue: number;
  expenses: number;
  profit: number;
  margin: number;
}

export interface OutstandingInvoiceRow {
  invoiceNumber: string;
  clientName: string | null;
  issueDate: string;
  dueDate: string;
  totalAmount: number;
  status: string;
  daysOverdue: number;
}

// ---------------------------------------------------------------------------
// Inventory report rows
// ---------------------------------------------------------------------------

export interface StockMovementReportRow {
  productName: string;
  sku: string;
  type: string;
  quantity: number;
  reference: string | null;
  notes: string | null;
  date: string;
}

export interface LowStockRow {
  name: string;
  sku: string;
  category: string;
  stockQuantity: number;
  minimumStock: number;
  deficit: number;
  costValue: number;
}

export interface InventoryValuationRow {
  name: string;
  sku: string;
  category: string;
  stockQuantity: number;
  costPrice: number;
  unitPrice: number;
  costValue: number;
  saleValue: number;
  grossMargin: number;
}

// ---------------------------------------------------------------------------
// Generic wrapper
// ---------------------------------------------------------------------------

export interface ReportResult<T> {
  data: T[];
  total: number;
  generatedAt: string;
  summary: Record<string, number | string>;
}
