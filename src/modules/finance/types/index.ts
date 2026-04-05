import type {
  Invoice,
  InvoiceItem,
  Payment,
  Expense,
  InvoiceStatus,
  PaymentMethod,
  ExpenseStatus,
  Client,
  Project,
  Staff,
} from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Re-export Prisma-generated types
// ---------------------------------------------------------------------------

export type {
  Invoice,
  InvoiceItem,
  Payment,
  Expense,
  InvoiceStatus,
  PaymentMethod,
  ExpenseStatus,
};

// ---------------------------------------------------------------------------
// Enriched types
// ---------------------------------------------------------------------------

export type InvoiceWithItems = Invoice & {
  items: InvoiceItem[];
  payments: Payment[];
  client: Pick<Client, "id" | "firstName" | "lastName" | "company"> | null;
  project: Pick<Project, "id" | "name"> | null;
};

export type ExpenseWithStaff = Expense & {
  staff: Pick<Staff, "id" | "firstName" | "lastName" | "email"> | null;
};

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  PAID: "Paid",
  OVERDUE: "Overdue",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Cash",
  BANK: "Bank Transfer",
  UPI: "UPI",
  CARD: "Card",
};

export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  PENDING:          "Pending",
  DRAFT:            "Draft",
  VALIDATING:       "Validating",
  AUTO_REJECTED:    "Auto-Rejected",
  PENDING_ACCOUNTS: "Pending (Accounts)",
  PENDING_OWNER:    "Pending (Owner)",
  APPROVED:         "Approved",
  REJECTED:         "Rejected",
  REIMBURSED:       "Reimbursed",
};

export const EXPENSE_CATEGORIES = [
  "Travel",
  "Food",
  "Fuel",
  "Office Supplies",
  "Client Entertainment",
  "Software",
  "Hardware",
  "Marketing",
  "Utilities",
  "Other",
] as const;

export const PAYMENT_MODES = [
  { value: "CASH",            label: "Cash" },
  { value: "UPI",             label: "UPI" },
  { value: "CARD",            label: "Card" },
  { value: "COMPANY_ACCOUNT", label: "Company Account" },
] as const;

// ---------------------------------------------------------------------------
// KPI types
// ---------------------------------------------------------------------------

export interface FinanceKPI {
  totalRevenue: number;
  outstandingInvoices: number;
  totalExpenses: number;
  netProfit: number;
  paidInvoicesCount: number;
  overdueInvoicesCount: number;
  pendingExpensesCount: number;
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
