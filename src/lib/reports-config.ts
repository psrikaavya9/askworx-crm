// ---------------------------------------------------------------------------
// Report Registry — single source of truth for all 16 reports
// ---------------------------------------------------------------------------

export type ReportCategory = "CRM" | "Projects" | "Staff" | "Finance" | "Inventory";

export interface ReportColumn {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  format?: "currency" | "date" | "datetime" | "percent" | "number" | "badge";
  badgeMap?: Record<string, "gray" | "blue" | "yellow" | "purple" | "green" | "red" | "indigo" | "orange">;
}

export interface ReportFilterDef {
  key: string;
  label: string;
  type: "date" | "select" | "text";
  options?: { value: string; label: string }[];
}

export interface ReportMeta {
  slug: string;
  title: string;
  description: string;
  category: ReportCategory;
  endpoint: string;
  columns: ReportColumn[];
  filters: ReportFilterDef[];
}

export const REPORTS: ReportMeta[] = [
  // ---- CRM ----
  {
    slug: "lead-funnel",
    title: "Lead Funnel Report",
    description: "Leads distributed across pipeline stages with conversion rates.",
    category: "CRM",
    endpoint: "/api/reports/lead-funnel",
    filters: [
      { key: "startDate", label: "From", type: "date" },
      { key: "endDate", label: "To", type: "date" },
    ],
    columns: [
      { key: "label", label: "Stage" },
      { key: "count", label: "Leads", align: "right", format: "number" },
      { key: "pct", label: "% of Total", align: "right", format: "percent" },
      { key: "totalValue", label: "Pipeline Value", align: "right", format: "currency" },
      { key: "avgDealValue", label: "Avg Deal", align: "right", format: "currency" },
    ],
  },
  {
    slug: "leads-by-source",
    title: "Leads by Source",
    description: "Lead distribution and conversion performance by acquisition channel.",
    category: "CRM",
    endpoint: "/api/reports/leads-by-source",
    filters: [
      { key: "startDate", label: "From", type: "date" },
      { key: "endDate", label: "To", type: "date" },
    ],
    columns: [
      { key: "label", label: "Source" },
      { key: "total", label: "Total", align: "right", format: "number" },
      { key: "won", label: "Won", align: "right", format: "number" },
      { key: "lost", label: "Lost", align: "right", format: "number" },
      { key: "active", label: "Active", align: "right", format: "number" },
      { key: "wonRate", label: "Win Rate", align: "right", format: "percent" },
      { key: "totalValue", label: "Won Value", align: "right", format: "currency" },
    ],
  },
  {
    slug: "lead-conversion",
    title: "Lead Conversion Report",
    description: "Leads that were converted to clients with timeline metrics.",
    category: "CRM",
    endpoint: "/api/reports/lead-conversion",
    filters: [
      { key: "startDate", label: "Converted From", type: "date" },
      { key: "endDate", label: "Converted To", type: "date" },
    ],
    columns: [
      { key: "name", label: "Lead Name" },
      { key: "company", label: "Company" },
      { key: "source", label: "Source" },
      { key: "createdAt", label: "Created", format: "date" },
      { key: "convertedAt", label: "Converted", format: "date" },
      { key: "daysToConvert", label: "Days", align: "right", format: "number" },
      { key: "dealValue", label: "Deal Value", align: "right", format: "currency" },
    ],
  },

  // ---- Projects ----
  {
    slug: "project-status",
    title: "Project Status Report",
    description: "All projects with current status, task progress, and time logged.",
    category: "Projects",
    endpoint: "/api/reports/project-status",
    filters: [
      {
        key: "status",
        label: "Status",
        type: "select",
        options: [
          { value: "", label: "All" },
          { value: "PLANNING", label: "Planning" },
          { value: "ACTIVE", label: "Active" },
          { value: "ON_HOLD", label: "On Hold" },
          { value: "COMPLETED", label: "Completed" },
        ],
      },
    ],
    columns: [
      { key: "name", label: "Project" },
      { key: "clientName", label: "Client" },
      {
        key: "status",
        label: "Status",
        format: "badge",
        badgeMap: {
          PLANNING: "indigo",
          ACTIVE: "green",
          ON_HOLD: "yellow",
          COMPLETED: "blue",
        },
      },
      { key: "taskCount", label: "Tasks", align: "right", format: "number" },
      { key: "doneTasks", label: "Done", align: "right", format: "number" },
      { key: "hoursLogged", label: "Hours", align: "right", format: "number" },
      { key: "deadline", label: "Deadline", format: "date" },
    ],
  },
  {
    slug: "project-completion",
    title: "Project Completion Report",
    description: "Project progress overview with task and hours breakdown.",
    category: "Projects",
    endpoint: "/api/reports/project-completion",
    filters: [
      { key: "startDate", label: "From", type: "date" },
      { key: "endDate", label: "To", type: "date" },
    ],
    columns: [
      { key: "name", label: "Project" },
      { key: "clientName", label: "Client" },
      {
        key: "status",
        label: "Status",
        format: "badge",
        badgeMap: {
          PLANNING: "indigo",
          ACTIVE: "green",
          ON_HOLD: "yellow",
          COMPLETED: "blue",
        },
      },
      { key: "totalTasks", label: "Total Tasks", align: "right", format: "number" },
      { key: "doneTasks", label: "Done", align: "right", format: "number" },
      { key: "hoursLogged", label: "Hours", align: "right", format: "number" },
      { key: "deadline", label: "Deadline", format: "date" },
    ],
  },
  {
    slug: "task-completion",
    title: "Task Completion Report",
    description: "All tasks with status, priority, and logged hours.",
    category: "Projects",
    endpoint: "/api/reports/task-completion",
    filters: [
      {
        key: "status",
        label: "Status",
        type: "select",
        options: [
          { value: "", label: "All" },
          { value: "TODO", label: "To Do" },
          { value: "IN_PROGRESS", label: "In Progress" },
          { value: "DONE", label: "Done" },
        ],
      },
    ],
    columns: [
      { key: "title", label: "Task" },
      { key: "projectName", label: "Project" },
      {
        key: "status",
        label: "Status",
        format: "badge",
        badgeMap: {
          TODO: "gray",
          IN_PROGRESS: "indigo",
          DONE: "green",
        },
      },
      {
        key: "priority",
        label: "Priority",
        format: "badge",
        badgeMap: {
          LOW: "gray",
          MEDIUM: "yellow",
          HIGH: "red",
        },
      },
      { key: "dueDate", label: "Due Date", format: "date" },
      { key: "hoursLogged", label: "Hours", align: "right", format: "number" },
    ],
  },

  // ---- Staff ----
  {
    slug: "attendance",
    title: "Attendance Report",
    description: "Detailed attendance records with check-in/out times and hours worked.",
    category: "Staff",
    endpoint: "/api/reports/attendance",
    filters: [
      { key: "startDate", label: "From", type: "date" },
      { key: "endDate", label: "To", type: "date" },
    ],
    columns: [
      { key: "staffName", label: "Staff" },
      { key: "department", label: "Department" },
      { key: "date", label: "Date", format: "date" },
      { key: "checkInTime", label: "Check In", format: "datetime" },
      { key: "checkOutTime", label: "Check Out", format: "datetime" },
      {
        key: "status",
        label: "Status",
        format: "badge",
        badgeMap: {
          PRESENT: "green",
          LATE: "yellow",
          ABSENT: "red",
        },
      },
      { key: "hoursWorked", label: "Hours", align: "right", format: "number" },
    ],
  },
  {
    slug: "late-checkins",
    title: "Late Check-ins Report",
    description: "All late attendance records with staff details.",
    category: "Staff",
    endpoint: "/api/reports/late-checkins",
    filters: [
      { key: "startDate", label: "From", type: "date" },
      { key: "endDate", label: "To", type: "date" },
    ],
    columns: [
      { key: "staffName", label: "Staff" },
      { key: "role", label: "Role" },
      { key: "department", label: "Department" },
      { key: "date", label: "Date", format: "date" },
      { key: "checkInTime", label: "Check In Time", format: "datetime" },
    ],
  },
  {
    slug: "staff-utilization",
    title: "Staff Utilization Report",
    description: "Attendance rate per staff member over the selected period.",
    category: "Staff",
    endpoint: "/api/reports/staff-utilization",
    filters: [
      { key: "startDate", label: "From", type: "date" },
      { key: "endDate", label: "To", type: "date" },
    ],
    columns: [
      { key: "staffName", label: "Staff" },
      { key: "role", label: "Role" },
      { key: "department", label: "Department" },
      { key: "totalDays", label: "Working Days", align: "right", format: "number" },
      { key: "present", label: "Present", align: "right", format: "number" },
      { key: "late", label: "Late", align: "right", format: "number" },
      { key: "absent", label: "Absent", align: "right", format: "number" },
      { key: "attendanceRate", label: "Rate", align: "right", format: "percent" },
    ],
  },

  // ---- Finance ----
  {
    slug: "revenue",
    title: "Revenue Report",
    description: "Paid invoices with subtotal, tax, and total amounts.",
    category: "Finance",
    endpoint: "/api/reports/revenue",
    filters: [
      { key: "startDate", label: "From", type: "date" },
      { key: "endDate", label: "To", type: "date" },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: [
          { value: "PAID", label: "Paid" },
          { value: "SENT", label: "Sent" },
          { value: "DRAFT", label: "Draft" },
          { value: "OVERDUE", label: "Overdue" },
        ],
      },
    ],
    columns: [
      { key: "invoiceNumber", label: "Invoice #" },
      { key: "clientName", label: "Client" },
      { key: "issueDate", label: "Issue Date", format: "date" },
      { key: "dueDate", label: "Due Date", format: "date" },
      { key: "subtotal", label: "Subtotal", align: "right", format: "currency" },
      { key: "totalTax", label: "Tax", align: "right", format: "currency" },
      { key: "totalAmount", label: "Total", align: "right", format: "currency" },
      {
        key: "status",
        label: "Status",
        format: "badge",
        badgeMap: {
          DRAFT: "gray",
          SENT: "blue",
          PAID: "green",
          OVERDUE: "red",
        },
      },
    ],
  },
  {
    slug: "expenses",
    title: "Expense Report",
    description: "All expenses filtered by date range, category, or staff member.",
    category: "Finance",
    endpoint: "/api/reports/expenses",
    filters: [
      { key: "startDate", label: "From", type: "date" },
      { key: "endDate", label: "To", type: "date" },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: [
          { value: "", label: "All" },
          { value: "PENDING", label: "Pending" },
          { value: "APPROVED", label: "Approved" },
          { value: "REJECTED", label: "Rejected" },
        ],
      },
    ],
    columns: [
      { key: "category", label: "Category" },
      { key: "description", label: "Description" },
      { key: "amount", label: "Amount", align: "right", format: "currency" },
      { key: "date", label: "Date", format: "date" },
      { key: "staffName", label: "Staff" },
      {
        key: "status",
        label: "Status",
        format: "badge",
        badgeMap: {
          PENDING: "yellow",
          APPROVED: "green",
          REJECTED: "red",
        },
      },
    ],
  },
  {
    slug: "profit-loss",
    title: "Profit & Loss Report",
    description: "Monthly revenue, expenses, and net profit with margin.",
    category: "Finance",
    endpoint: "/api/reports/profit-loss",
    filters: [
      { key: "startDate", label: "From", type: "date" },
      { key: "endDate", label: "To", type: "date" },
    ],
    columns: [
      { key: "period", label: "Period" },
      { key: "revenue", label: "Revenue", align: "right", format: "currency" },
      { key: "expenses", label: "Expenses", align: "right", format: "currency" },
      { key: "profit", label: "Net Profit", align: "right", format: "currency" },
      { key: "margin", label: "Margin %", align: "right", format: "percent" },
    ],
  },
  {
    slug: "outstanding-invoices",
    title: "Outstanding Invoices Report",
    description: "All unpaid invoices (Sent + Overdue) with days overdue.",
    category: "Finance",
    endpoint: "/api/reports/outstanding-invoices",
    filters: [
      {
        key: "status",
        label: "Status",
        type: "select",
        options: [
          { value: "", label: "All Outstanding" },
          { value: "SENT", label: "Sent" },
          { value: "OVERDUE", label: "Overdue" },
        ],
      },
    ],
    columns: [
      { key: "invoiceNumber", label: "Invoice #" },
      { key: "clientName", label: "Client" },
      { key: "issueDate", label: "Issue Date", format: "date" },
      { key: "dueDate", label: "Due Date", format: "date" },
      { key: "totalAmount", label: "Amount", align: "right", format: "currency" },
      {
        key: "status",
        label: "Status",
        format: "badge",
        badgeMap: { SENT: "blue", OVERDUE: "red" },
      },
      { key: "daysOverdue", label: "Days Overdue", align: "right", format: "number" },
    ],
  },

  // ---- Inventory ----
  {
    slug: "stock-movement",
    title: "Stock Movement Report",
    description: "All stock IN/OUT/ADJUSTMENT movements with product details.",
    category: "Inventory",
    endpoint: "/api/reports/stock-movement",
    filters: [
      { key: "startDate", label: "From", type: "date" },
      { key: "endDate", label: "To", type: "date" },
      {
        key: "type",
        label: "Movement Type",
        type: "select",
        options: [
          { value: "", label: "All" },
          { value: "IN", label: "Stock In" },
          { value: "OUT", label: "Stock Out" },
          { value: "ADJUSTMENT", label: "Adjustment" },
        ],
      },
    ],
    columns: [
      { key: "productName", label: "Product" },
      { key: "sku", label: "SKU" },
      {
        key: "type",
        label: "Type",
        format: "badge",
        badgeMap: {
          IN: "green",
          OUT: "orange",
          ADJUSTMENT: "blue",
        },
      },
      { key: "quantity", label: "Qty", align: "right", format: "number" },
      { key: "reference", label: "Reference" },
      { key: "date", label: "Date", format: "datetime" },
    ],
  },
  {
    slug: "low-stock",
    title: "Low Stock Report",
    description: "Products at or below their minimum stock threshold.",
    category: "Inventory",
    endpoint: "/api/reports/low-stock",
    filters: [
      { key: "category", label: "Category", type: "text" },
    ],
    columns: [
      { key: "name", label: "Product" },
      { key: "sku", label: "SKU" },
      { key: "category", label: "Category" },
      { key: "stockQuantity", label: "Stock", align: "right", format: "number" },
      { key: "minimumStock", label: "Minimum", align: "right", format: "number" },
      { key: "deficit", label: "Deficit", align: "right", format: "number" },
      { key: "costValue", label: "Stock Value", align: "right", format: "currency" },
    ],
  },
  {
    slug: "inventory-value",
    title: "Inventory Valuation Report",
    description: "Full inventory with cost value, sale value, and margin per product.",
    category: "Inventory",
    endpoint: "/api/reports/inventory-value",
    filters: [
      { key: "category", label: "Category", type: "text" },
    ],
    columns: [
      { key: "name", label: "Product" },
      { key: "sku", label: "SKU" },
      { key: "category", label: "Category" },
      { key: "stockQuantity", label: "Qty", align: "right", format: "number" },
      { key: "costPrice", label: "Cost Price", align: "right", format: "currency" },
      { key: "unitPrice", label: "Sale Price", align: "right", format: "currency" },
      { key: "costValue", label: "Cost Value", align: "right", format: "currency" },
      { key: "saleValue", label: "Sale Value", align: "right", format: "currency" },
      { key: "grossMargin", label: "Margin %", align: "right", format: "percent" },
    ],
  },
];

export const REPORTS_BY_SLUG = Object.fromEntries(REPORTS.map((r) => [r.slug, r]));

export const REPORTS_BY_CATEGORY = REPORTS.reduce((acc, r) => {
  (acc[r.category] ??= []).push(r);
  return acc;
}, {} as Record<ReportCategory, ReportMeta[]>);

export const CATEGORY_COLORS: Record<ReportCategory, string> = {
  CRM: "bg-indigo-50 text-indigo-600 border-indigo-100",
  Projects: "bg-purple-50 text-purple-600 border-purple-100",
  Staff: "bg-teal-50 text-teal-600 border-teal-100",
  Finance: "bg-green-50 text-green-600 border-green-100",
  Inventory: "bg-orange-50 text-orange-600 border-orange-100",
};

export const CATEGORY_BADGE_COLOR: Record<ReportCategory, "indigo" | "purple" | "blue" | "green" | "orange"> = {
  CRM: "indigo",
  Projects: "purple",
  Staff: "blue",
  Finance: "green",
  Inventory: "orange",
};
