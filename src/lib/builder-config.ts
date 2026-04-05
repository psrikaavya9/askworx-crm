import type { ModuleDef, BuilderModuleId } from "@/modules/reports/types/builder";

// ---------------------------------------------------------------------------
// Field helpers
// ---------------------------------------------------------------------------

const STR_OPS = ["eq", "neq", "contains"] as const;
const NUM_OPS = ["eq", "gt", "gte", "lt", "lte"] as const;
const DATE_OPS = ["gte", "lte", "eq"] as const;
const ENUM_OPS = ["eq", "neq"] as const;

// ---------------------------------------------------------------------------
// Module definitions
// ---------------------------------------------------------------------------

export const BUILDER_MODULES: ModuleDef[] = [
  // ---- CRM ----
  {
    id: "CRM_LEADS",
    label: "CRM — Leads",
    category: "CRM",
    description: "Lead pipeline with source, stage, and deal value.",
    fields: [
      { key: "name",        label: "Full Name",   type: "string",  filterable: true,  operators: [...STR_OPS] },
      { key: "email",       label: "Email",       type: "string",  filterable: true,  operators: [...STR_OPS] },
      { key: "phone",       label: "Phone",       type: "string",  filterable: false },
      { key: "company",     label: "Company",     type: "string",  filterable: true,  operators: [...STR_OPS] },
      { key: "stage",       label: "Stage",       type: "enum",    filterable: true,  operators: [...ENUM_OPS],
        enumValues: ["NEW","CONTACTED","QUALIFIED","PROPOSAL","WON","LOST"] },
      { key: "source",      label: "Source",      type: "enum",    filterable: true,  operators: [...ENUM_OPS],
        enumValues: ["WEBSITE","REFERRAL","SOCIAL_MEDIA","EMAIL_CAMPAIGN","COLD_CALL","TRADE_SHOW","PARTNER","OTHER"] },
      { key: "priority",    label: "Priority",    type: "enum",    filterable: true,  operators: [...ENUM_OPS],
        enumValues: ["LOW","MEDIUM","HIGH"] },
      { key: "dealValue",   label: "Deal Value",  type: "decimal", filterable: true,  operators: [...NUM_OPS] },
      { key: "createdAt",   label: "Created At",  type: "date",    filterable: true,  operators: [...DATE_OPS] },
    ],
  },
  {
    id: "CRM_CLIENTS",
    label: "CRM — Clients",
    category: "CRM",
    description: "Converted clients with company and contact details.",
    fields: [
      { key: "name",      label: "Full Name",  type: "string", filterable: true, operators: [...STR_OPS] },
      { key: "email",     label: "Email",      type: "string", filterable: true, operators: [...STR_OPS] },
      { key: "company",   label: "Company",    type: "string", filterable: true, operators: [...STR_OPS] },
      { key: "phone",     label: "Phone",      type: "string", filterable: false },
      { key: "city",      label: "City",       type: "string", filterable: true, operators: [...STR_OPS] },
      { key: "country",   label: "Country",    type: "string", filterable: true, operators: [...STR_OPS] },
      { key: "createdAt", label: "Client Since", type: "date", filterable: true, operators: [...DATE_OPS] },
    ],
  },

  // ---- Projects ----
  {
    id: "PROJECTS",
    label: "Projects",
    category: "Projects",
    description: "Project list with status, deadline, and task progress.",
    fields: [
      { key: "name",        label: "Project Name", type: "string", filterable: true,  operators: [...STR_OPS] },
      { key: "status",      label: "Status",       type: "enum",   filterable: true,  operators: [...ENUM_OPS],
        enumValues: ["PLANNING","ACTIVE","ON_HOLD","COMPLETED"] },
      { key: "clientName",  label: "Client",       type: "string", filterable: true,  operators: [...STR_OPS] },
      { key: "startDate",   label: "Start Date",   type: "date",   filterable: true,  operators: [...DATE_OPS] },
      { key: "deadline",    label: "Deadline",     type: "date",   filterable: true,  operators: [...DATE_OPS] },
      { key: "taskCount",   label: "Total Tasks",  type: "number", filterable: true,  operators: [...NUM_OPS] },
      { key: "doneTasks",   label: "Done Tasks",   type: "number", filterable: false },
      { key: "hoursLogged", label: "Hours Logged", type: "decimal",filterable: true,  operators: [...NUM_OPS] },
      { key: "createdAt",   label: "Created At",   type: "date",   filterable: true,  operators: [...DATE_OPS] },
    ],
  },
  {
    id: "TASKS",
    label: "Tasks",
    category: "Projects",
    description: "All tasks with status, priority, and time tracking.",
    fields: [
      { key: "title",       label: "Task Title",   type: "string", filterable: true,  operators: [...STR_OPS] },
      { key: "projectName", label: "Project",      type: "string", filterable: true,  operators: [...STR_OPS] },
      { key: "status",      label: "Status",       type: "enum",   filterable: true,  operators: [...ENUM_OPS],
        enumValues: ["TODO","IN_PROGRESS","DONE"] },
      { key: "priority",    label: "Priority",     type: "enum",   filterable: true,  operators: [...ENUM_OPS],
        enumValues: ["LOW","MEDIUM","HIGH"] },
      { key: "dueDate",     label: "Due Date",     type: "date",   filterable: true,  operators: [...DATE_OPS] },
      { key: "hoursLogged", label: "Hours Logged", type: "decimal",filterable: true,  operators: [...NUM_OPS] },
      { key: "createdAt",   label: "Created At",   type: "date",   filterable: true,  operators: [...DATE_OPS] },
    ],
  },

  // ---- Staff ----
  {
    id: "STAFF",
    label: "Staff",
    category: "Staff",
    description: "Staff members with role, department, and status.",
    fields: [
      { key: "name",       label: "Full Name",  type: "string", filterable: true, operators: [...STR_OPS] },
      { key: "email",      label: "Email",      type: "string", filterable: true, operators: [...STR_OPS] },
      { key: "role",       label: "Role",       type: "enum",   filterable: true, operators: [...ENUM_OPS],
        enumValues: ["ADMIN","MANAGER","STAFF"] },
      { key: "department", label: "Department", type: "string", filterable: true, operators: [...STR_OPS] },
      { key: "status",     label: "Status",     type: "enum",   filterable: true, operators: [...ENUM_OPS],
        enumValues: ["ACTIVE","INACTIVE"] },
      { key: "createdAt",  label: "Joined At",  type: "date",   filterable: true, operators: [...DATE_OPS] },
    ],
  },
  {
    id: "ATTENDANCE",
    label: "Attendance",
    category: "Staff",
    description: "Attendance records with check-in/out times.",
    fields: [
      { key: "staffName",    label: "Staff",      type: "string",   filterable: true, operators: [...STR_OPS] },
      { key: "department",   label: "Department", type: "string",   filterable: true, operators: [...STR_OPS] },
      { key: "date",         label: "Date",       type: "date",     filterable: true, operators: [...DATE_OPS] },
      { key: "checkInTime",  label: "Check In",   type: "datetime", filterable: false },
      { key: "checkOutTime", label: "Check Out",  type: "datetime", filterable: false },
      { key: "status",       label: "Status",     type: "enum",     filterable: true, operators: [...ENUM_OPS],
        enumValues: ["PRESENT","LATE","ABSENT"] },
      { key: "hoursWorked",  label: "Hours",      type: "decimal",  filterable: true, operators: [...NUM_OPS] },
    ],
  },

  // ---- Finance ----
  {
    id: "INVOICES",
    label: "Invoices",
    category: "Finance",
    description: "Invoices with client, amounts, and payment status.",
    fields: [
      { key: "invoiceNumber", label: "Invoice #",   type: "string",  filterable: true, operators: [...STR_OPS] },
      { key: "clientName",    label: "Client",      type: "string",  filterable: true, operators: [...STR_OPS] },
      { key: "issueDate",     label: "Issue Date",  type: "date",    filterable: true, operators: [...DATE_OPS] },
      { key: "dueDate",       label: "Due Date",    type: "date",    filterable: true, operators: [...DATE_OPS] },
      { key: "subtotal",      label: "Subtotal",    type: "decimal", filterable: true, operators: [...NUM_OPS] },
      { key: "totalTax",      label: "Total Tax",   type: "decimal", filterable: false },
      { key: "totalAmount",   label: "Total",       type: "decimal", filterable: true, operators: [...NUM_OPS] },
      { key: "status",        label: "Status",      type: "enum",    filterable: true, operators: [...ENUM_OPS],
        enumValues: ["DRAFT","SENT","PAID","OVERDUE"] },
    ],
  },
  {
    id: "EXPENSES",
    label: "Expenses",
    category: "Finance",
    description: "Expense records with category, amount, and approval status.",
    fields: [
      { key: "category",    label: "Category",    type: "string",  filterable: true, operators: [...STR_OPS] },
      { key: "description", label: "Description", type: "string",  filterable: true, operators: [...STR_OPS] },
      { key: "amount",      label: "Amount",      type: "decimal", filterable: true, operators: [...NUM_OPS] },
      { key: "date",        label: "Date",        type: "date",    filterable: true, operators: [...DATE_OPS] },
      { key: "staffName",   label: "Staff",       type: "string",  filterable: true, operators: [...STR_OPS] },
      { key: "status",      label: "Status",      type: "enum",    filterable: true, operators: [...ENUM_OPS],
        enumValues: ["PENDING","APPROVED","REJECTED"] },
    ],
  },

  // ---- Inventory ----
  {
    id: "PRODUCTS",
    label: "Products",
    category: "Inventory",
    description: "Product catalogue with stock levels and pricing.",
    fields: [
      { key: "name",          label: "Product Name",  type: "string",  filterable: true, operators: [...STR_OPS] },
      { key: "sku",           label: "SKU",           type: "string",  filterable: true, operators: [...STR_OPS] },
      { key: "category",      label: "Category",      type: "string",  filterable: true, operators: [...STR_OPS] },
      { key: "stockQuantity", label: "Stock Qty",     type: "number",  filterable: true, operators: [...NUM_OPS] },
      { key: "minimumStock",  label: "Min Stock",     type: "number",  filterable: true, operators: [...NUM_OPS] },
      { key: "costPrice",     label: "Cost Price",    type: "decimal", filterable: true, operators: [...NUM_OPS] },
      { key: "unitPrice",     label: "Unit Price",    type: "decimal", filterable: true, operators: [...NUM_OPS] },
      { key: "createdAt",     label: "Added At",      type: "date",    filterable: true, operators: [...DATE_OPS] },
    ],
  },
  {
    id: "STOCK_MOVEMENTS",
    label: "Stock Movements",
    category: "Inventory",
    description: "Stock IN/OUT/ADJUSTMENT movements with product details.",
    fields: [
      { key: "productName", label: "Product",   type: "string",   filterable: true, operators: [...STR_OPS] },
      { key: "sku",         label: "SKU",       type: "string",   filterable: true, operators: [...STR_OPS] },
      { key: "type",        label: "Type",      type: "enum",     filterable: true, operators: [...ENUM_OPS],
        enumValues: ["IN","OUT","ADJUSTMENT"] },
      { key: "quantity",    label: "Quantity",  type: "number",   filterable: true, operators: [...NUM_OPS] },
      { key: "reference",   label: "Reference", type: "string",   filterable: true, operators: [...STR_OPS] },
      { key: "date",        label: "Date",      type: "datetime", filterable: true, operators: [...DATE_OPS] },
    ],
  },
];

export const BUILDER_MODULES_BY_ID: Record<BuilderModuleId, ModuleDef> =
  Object.fromEntries(BUILDER_MODULES.map((m) => [m.id, m])) as Record<BuilderModuleId, ModuleDef>;

export const BUILDER_MODULES_BY_CATEGORY = BUILDER_MODULES.reduce((acc, m) => {
  (acc[m.category] ??= []).push(m);
  return acc;
}, {} as Record<string, ModuleDef[]>);

export const OPERATOR_LABELS: Record<string, string> = {
  eq: "equals",
  neq: "not equals",
  contains: "contains",
  gt: "greater than",
  gte: "greater than or equal",
  lt: "less than",
  lte: "less than or equal",
};
