import { prisma } from "@/lib/prisma";
import { BUILDER_MODULES_BY_ID } from "@/lib/builder-config";
import type {
  BuilderModuleId,
  BuilderRequest,
  BuilderResult,
  FilterCondition,
  SaveReportInput,
  SavedReportRecord,
  FieldType,
} from "../types/builder";

const MAX_ROWS = 1000;

// ---------------------------------------------------------------------------
// Where clause builder
// ---------------------------------------------------------------------------

type PrismaWhere = Record<string, unknown>;

function buildCondition(type: FieldType, operator: string, value: string): unknown {
  const strVal = value;
  const numVal = Number(value);
  const dateVal = new Date(value);

  switch (operator) {
    case "eq":
      return type === "number" || type === "decimal" ? numVal : strVal;
    case "neq":
      return { not: type === "number" || type === "decimal" ? numVal : strVal };
    case "contains":
      return { contains: strVal, mode: "insensitive" };
    case "gt":
      return { gt: type === "date" || type === "datetime" ? dateVal : numVal };
    case "gte":
      return { gte: type === "date" || type === "datetime" ? dateVal : numVal };
    case "lt":
      return { lt: type === "date" || type === "datetime" ? dateVal : numVal };
    case "lte":
      return { lte: type === "date" || type === "datetime" ? dateVal : numVal };
    default:
      return strVal;
  }
}

// Maps virtual field keys (used in results) to their actual Prisma field path
type FieldMap = Record<string, string>; // virtualKey → prismaFieldPath

function applyFilters(
  conditions: FilterCondition[],
  fieldMap: FieldMap,
  moduleId: BuilderModuleId
): PrismaWhere {
  const where: PrismaWhere = {};
  const moduleDef = BUILDER_MODULES_BY_ID[moduleId];
  if (!moduleDef) return where;

  for (const cond of conditions) {
    const fieldDef = moduleDef.fields.find((f) => f.key === cond.field);
    if (!fieldDef || !fieldDef.filterable) continue;

    const prismaPath = fieldMap[cond.field] ?? cond.field;
    // Only apply filters on direct (non-relation) fields
    if (prismaPath.includes(".")) continue;

    const condition = buildCondition(fieldDef.type, cond.operator, cond.value);
    where[prismaPath] = condition;
  }

  return where;
}

// ---------------------------------------------------------------------------
// Module query runners
// ---------------------------------------------------------------------------

async function queryCRMLeads(
  selectedFields: string[],
  conditions: FilterCondition[]
): Promise<Record<string, unknown>[]> {
  const fieldMap: FieldMap = {
    name: "_computed_name",
    email: "email",
    phone: "phone",
    company: "company",
    stage: "stage",
    source: "source",
    priority: "priority",
    dealValue: "dealValue",
    createdAt: "createdAt",
  };

  const where = applyFilters(conditions, fieldMap, "CRM_LEADS");

  // Handle name filter specially
  const nameCond = conditions.find((c) => c.field === "name");
  if (nameCond && (nameCond.operator === "contains" || nameCond.operator === "eq")) {
    where.OR = [
      { firstName: { contains: nameCond.value, mode: "insensitive" } },
      { lastName: { contains: nameCond.value, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.lead.findMany({
    where,
    select: {
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      company: true,
      stage: true,
      source: true,
      priority: true,
      dealValue: true,
      createdAt: true,
    },
    take: MAX_ROWS,
    orderBy: { createdAt: "desc" },
  });

  return rows.map((r) => ({
    name: `${r.firstName} ${r.lastName}`,
    email: r.email,
    phone: r.phone,
    company: r.company,
    stage: r.stage,
    source: r.source,
    priority: r.priority,
    dealValue: Number(r.dealValue ?? 0),
    createdAt: r.createdAt.toISOString(),
  }));
}

async function queryCRMClients(
  selectedFields: string[],
  conditions: FilterCondition[]
): Promise<Record<string, unknown>[]> {
  const where = applyFilters(conditions, {
    name: "_computed_name", email: "email", company: "company",
    phone: "phone", city: "city", country: "country", createdAt: "createdAt",
  }, "CRM_CLIENTS");

  const nameCond = conditions.find((c) => c.field === "name");
  if (nameCond) {
    where.OR = [
      { firstName: { contains: nameCond.value, mode: "insensitive" } },
      { lastName: { contains: nameCond.value, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.client.findMany({
    where,
    select: {
      firstName: true, lastName: true, email: true, phone: true,
      company: true, city: true, country: true, createdAt: true,
    },
    take: MAX_ROWS,
    orderBy: { createdAt: "desc" },
  });

  return rows.map((r) => ({
    name: `${r.firstName} ${r.lastName}`,
    email: r.email,
    phone: r.phone,
    company: r.company,
    city: r.city,
    country: r.country,
    createdAt: r.createdAt.toISOString(),
  }));
}

async function queryProjects(
  selectedFields: string[],
  conditions: FilterCondition[]
): Promise<Record<string, unknown>[]> {
  const where = applyFilters(conditions, {
    name: "name", status: "status", startDate: "startDate",
    deadline: "deadline", createdAt: "createdAt",
    clientName: "_relation", taskCount: "_computed", doneTasks: "_computed", hoursLogged: "_computed",
  }, "PROJECTS");

  const rows = await prisma.project.findMany({
    where,
    select: {
      name: true, status: true, startDate: true, deadline: true, createdAt: true,
      client: { select: { firstName: true, lastName: true } },
      tasks: { select: { status: true, hoursLogged: true } },
    },
    take: MAX_ROWS,
    orderBy: { createdAt: "desc" },
  });

  return rows.map((r) => ({
    name: r.name,
    status: r.status,
    clientName: r.client ? `${r.client.firstName} ${r.client.lastName}` : null,
    startDate: r.startDate?.toISOString() ?? null,
    deadline: r.deadline?.toISOString() ?? null,
    taskCount: r.tasks.length,
    doneTasks: r.tasks.filter((t) => t.status === "DONE").length,
    hoursLogged: r.tasks.reduce((s, t) => s + Number(t.hoursLogged), 0),
    createdAt: r.createdAt.toISOString(),
  }));
}

async function queryTasks(
  selectedFields: string[],
  conditions: FilterCondition[]
): Promise<Record<string, unknown>[]> {
  const where = applyFilters(conditions, {
    title: "title", status: "status", priority: "priority",
    dueDate: "dueDate", hoursLogged: "hoursLogged", createdAt: "createdAt",
    projectName: "_relation",
  }, "TASKS");

  const rows = await prisma.task.findMany({
    where,
    select: {
      title: true, status: true, priority: true, dueDate: true,
      hoursLogged: true, createdAt: true,
      project: { select: { name: true } },
    },
    take: MAX_ROWS,
    orderBy: { createdAt: "desc" },
  });

  return rows.map((r) => ({
    title: r.title,
    projectName: r.project.name,
    status: r.status,
    priority: r.priority,
    dueDate: r.dueDate?.toISOString() ?? null,
    hoursLogged: Number(r.hoursLogged),
    createdAt: r.createdAt.toISOString(),
  }));
}

async function queryStaff(
  selectedFields: string[],
  conditions: FilterCondition[]
): Promise<Record<string, unknown>[]> {
  const where = applyFilters(conditions, {
    name: "_computed_name", email: "email", role: "role",
    department: "department", status: "status", createdAt: "createdAt",
  }, "STAFF");

  const nameCond = conditions.find((c) => c.field === "name");
  if (nameCond) {
    where.OR = [
      { firstName: { contains: nameCond.value, mode: "insensitive" } },
      { lastName: { contains: nameCond.value, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.staff.findMany({
    where,
    select: {
      firstName: true, lastName: true, email: true, role: true,
      department: true, status: true, createdAt: true,
    },
    take: MAX_ROWS,
    orderBy: { createdAt: "desc" },
  });

  return rows.map((r) => ({
    name: `${r.firstName} ${r.lastName}`,
    email: r.email,
    role: r.role,
    department: r.department,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  }));
}

async function queryAttendance(
  selectedFields: string[],
  conditions: FilterCondition[]
): Promise<Record<string, unknown>[]> {
  const where = applyFilters(conditions, {
    date: "date", status: "attendanceStatus",
    staffName: "_relation", department: "_relation",
    checkInTime: "_computed", checkOutTime: "_computed", hoursWorked: "_computed",
  }, "ATTENDANCE");

  // status filter maps to attendanceStatus
  const statusCond = conditions.find((c) => c.field === "status");
  if (statusCond) {
    where.attendanceStatus = statusCond.value;
    delete where.status;
  }

  const rows = await prisma.attendance.findMany({
    where,
    include: {
      staff: { select: { firstName: true, lastName: true, department: true } },
    },
    take: MAX_ROWS,
    orderBy: { date: "desc" },
  });

  return rows.map((r) => {
    const hoursWorked =
      r.checkInTime && r.checkOutTime
        ? Math.round(((r.checkOutTime.getTime() - r.checkInTime.getTime()) / 3600000) * 10) / 10
        : null;
    return {
      staffName: `${r.staff.firstName} ${r.staff.lastName}`,
      department: r.staff.department,
      date: r.date.toISOString(),
      checkInTime: r.checkInTime?.toISOString() ?? null,
      checkOutTime: r.checkOutTime?.toISOString() ?? null,
      status: r.attendanceStatus,
      hoursWorked,
    };
  });
}

async function queryInvoices(
  selectedFields: string[],
  conditions: FilterCondition[]
): Promise<Record<string, unknown>[]> {
  const where = applyFilters(conditions, {
    invoiceNumber: "invoiceNumber", issueDate: "issueDate", dueDate: "dueDate",
    subtotal: "subtotal", totalTax: "totalTax", totalAmount: "totalAmount",
    status: "status", clientName: "_relation",
  }, "INVOICES");

  const rows = await prisma.invoice.findMany({
    where,
    select: {
      invoiceNumber: true, issueDate: true, dueDate: true,
      subtotal: true, totalTax: true, totalAmount: true, status: true,
      client: { select: { firstName: true, lastName: true } },
    },
    take: MAX_ROWS,
    orderBy: { issueDate: "desc" },
  });

  return rows.map((r) => ({
    invoiceNumber: r.invoiceNumber,
    clientName: r.client ? `${r.client.firstName} ${r.client.lastName}` : null,
    issueDate: r.issueDate.toISOString(),
    dueDate: r.dueDate.toISOString(),
    subtotal: Number(r.subtotal),
    totalTax: Number(r.totalTax),
    totalAmount: Number(r.totalAmount),
    status: r.status,
  }));
}

async function queryExpenses(
  selectedFields: string[],
  conditions: FilterCondition[]
): Promise<Record<string, unknown>[]> {
  const where = applyFilters(conditions, {
    category: "category", description: "description",
    amount: "amount", date: "date", status: "status", staffName: "_relation",
  }, "EXPENSES");

  const rows = await prisma.expense.findMany({
    where,
    include: {
      staff: { select: { firstName: true, lastName: true } },
    },
    take: MAX_ROWS,
    orderBy: { date: "desc" },
  });

  return rows.map((r) => ({
    category: r.category,
    description: r.description,
    amount: Number(r.amount),
    date: r.date.toISOString(),
    staffName: r.staff ? `${r.staff.firstName} ${r.staff.lastName}` : null,
    status: r.status,
  }));
}

async function queryProducts(
  selectedFields: string[],
  conditions: FilterCondition[]
): Promise<Record<string, unknown>[]> {
  const where = applyFilters(conditions, {
    name: "name", sku: "sku", category: "category",
    stockQuantity: "stockQuantity", minimumStock: "minimumStock",
    costPrice: "costPrice", unitPrice: "unitPrice", createdAt: "createdAt",
  }, "PRODUCTS");

  const rows = await prisma.product.findMany({
    where,
    select: {
      name: true, sku: true, category: true,
      stockQuantity: true, minimumStock: true,
      costPrice: true, unitPrice: true, createdAt: true,
    },
    take: MAX_ROWS,
    orderBy: { name: "asc" },
  });

  return rows.map((r) => ({
    name: r.name,
    sku: r.sku,
    category: r.category,
    stockQuantity: r.stockQuantity,
    minimumStock: r.minimumStock,
    costPrice: Number(r.costPrice),
    unitPrice: Number(r.unitPrice),
    createdAt: r.createdAt.toISOString(),
  }));
}

async function queryStockMovements(
  selectedFields: string[],
  conditions: FilterCondition[]
): Promise<Record<string, unknown>[]> {
  const where = applyFilters(conditions, {
    type: "type", quantity: "quantity", reference: "reference",
    date: "createdAt", productName: "_relation", sku: "_relation",
  }, "STOCK_MOVEMENTS");

  // date filter maps to createdAt
  const dateCond = conditions.find((c) => c.field === "date");
  if (dateCond) {
    const { operator, value } = dateCond;
    const dateVal = new Date(value);
    if (operator === "gte") where.createdAt = { gte: dateVal };
    else if (operator === "lte") where.createdAt = { lte: dateVal };
    else if (operator === "eq") where.createdAt = dateVal;
    delete where.date;
  }

  const rows = await prisma.stockMovement.findMany({
    where,
    include: {
      product: { select: { name: true, sku: true } },
    },
    take: MAX_ROWS,
    orderBy: { createdAt: "desc" },
  });

  return rows.map((r) => ({
    productName: r.product.name,
    sku: r.product.sku,
    type: r.type,
    quantity: r.quantity,
    reference: r.reference,
    date: r.createdAt.toISOString(),
  }));
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

async function runQuery(
  moduleId: BuilderModuleId,
  selectedFields: string[],
  filters: FilterCondition[]
): Promise<Record<string, unknown>[]> {
  switch (moduleId) {
    case "CRM_LEADS":      return queryCRMLeads(selectedFields, filters);
    case "CRM_CLIENTS":    return queryCRMClients(selectedFields, filters);
    case "PROJECTS":       return queryProjects(selectedFields, filters);
    case "TASKS":          return queryTasks(selectedFields, filters);
    case "STAFF":          return queryStaff(selectedFields, filters);
    case "ATTENDANCE":     return queryAttendance(selectedFields, filters);
    case "INVOICES":       return queryInvoices(selectedFields, filters);
    case "EXPENSES":       return queryExpenses(selectedFields, filters);
    case "PRODUCTS":       return queryProducts(selectedFields, filters);
    case "STOCK_MOVEMENTS":return queryStockMovements(selectedFields, filters);
    default:               return [];
  }
}

// ---------------------------------------------------------------------------
// Public service functions
// ---------------------------------------------------------------------------

export async function generateReport(req: BuilderRequest): Promise<BuilderResult> {
  const moduleDef = BUILDER_MODULES_BY_ID[req.module];
  if (!moduleDef) throw new Error(`Unknown module: ${req.module}`);

  const selected = req.selectedFields.length > 0 ? req.selectedFields : moduleDef.fields.map((f) => f.key);

  const allRows = await runQuery(req.module, selected, req.filters);

  // Filter rows to only include selected fields
  const projectedRows = allRows.map((row) =>
    Object.fromEntries(selected.filter((k) => k in row).map((k) => [k, row[k]]))
  );

  const limited = projectedRows.slice(0, req.limit ?? MAX_ROWS);

  const columns = selected
    .map((key) => moduleDef.fields.find((f) => f.key === key))
    .filter(Boolean)
    .map((f) => ({ key: f!.key, label: f!.label, type: f!.type }));

  return {
    module: req.module,
    columns,
    data: limited,
    total: limited.length,
    truncated: projectedRows.length > (req.limit ?? MAX_ROWS),
    generatedAt: new Date().toISOString(),
  };
}

export async function saveReport(input: SaveReportInput): Promise<SavedReportRecord> {
  const saved = await prisma.savedReport.create({
    data: {
      name: input.name,
      module: input.module,
      selectedFields: input.selectedFields,
      filters: input.filters as object[],
    },
    include: { _count: { select: { executions: true } } },
  });

  return {
    id: saved.id,
    name: saved.name,
    module: saved.module as BuilderModuleId,
    selectedFields: saved.selectedFields as string[],
    filters: saved.filters as unknown as import("../types/builder").FilterCondition[],
    createdAt: saved.createdAt.toISOString(),
    updatedAt: saved.updatedAt.toISOString(),
    executionCount: saved._count.executions,
    lastRun: null,
  };
}

export async function getSavedReports(): Promise<SavedReportRecord[]> {
  const reports = await prisma.savedReport.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { executions: true } },
      executions: {
        orderBy: { executedAt: "desc" },
        take: 1,
        select: { executedAt: true },
      },
    },
  });

  return reports.map((r) => ({
    id: r.id,
    name: r.name,
    module: r.module as BuilderModuleId,
    selectedFields: r.selectedFields as string[],
    filters: r.filters as unknown as import("../types/builder").FilterCondition[],
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    executionCount: r._count.executions,
    lastRun: r.executions[0]?.executedAt.toISOString() ?? null,
  }));
}

export async function runSavedReport(id: string): Promise<BuilderResult> {
  const saved = await prisma.savedReport.findUniqueOrThrow({ where: { id } });

  const result = await generateReport({
    module: saved.module as BuilderModuleId,
    selectedFields: saved.selectedFields as string[],
    filters: saved.filters as unknown as FilterCondition[],
  });

  // Record execution
  await prisma.reportExecution.create({
    data: { reportId: id, resultCount: result.total },
  });

  return result;
}

export async function deleteSavedReport(id: string): Promise<void> {
  await prisma.savedReport.delete({ where: { id } });
}
