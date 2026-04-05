/**
 * expenseAnalytics.repository.ts
 *
 * All analytics queries for the Expense Analytics Dashboard.
 * Uses Prisma ORM for simple aggregations and $queryRaw (with parameterised
 * SQL) for queries that require DATE_TRUNC or multi-table JOINs — operations
 * that Prisma's query builder cannot express natively.
 *
 * Performance notes
 * ─────────────────
 * The existing @@index([staffId]), @@index([status]), @@index([date]),
 * @@index([category]) indexes on the Expense table cover all WHERE clauses
 * used here.  No additional indexes are needed.
 */

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { AnalyticsFilters } from "../schemas/expenseAnalytics.schema";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Build a Prisma WhereInput for the common date + optional filters.
 * Used by aggregate() and groupBy() calls (Prisma ORM style).
 */
function buildWhere(f: AnalyticsFilters): Prisma.ExpenseWhereInput {
  const where: Prisma.ExpenseWhereInput = { date: { gte: f.from, lte: f.to } };
  if (f.category) where.category = f.category;
  if (f.staffId)  where.staffId  = f.staffId;
  return where;
}

/**
 * Build a Prisma.Sql WHERE clause fragment (for $queryRaw).
 * Column references use the bare name (no table alias) — safe for
 * single-table queries (summary, category, monthly, rejections).
 */
function buildSqlWhere(f: AnalyticsFilters): Prisma.Sql {
  const parts: Prisma.Sql[] = [
    Prisma.sql`date >= ${f.from}`,
    Prisma.sql`date <= ${f.to}`,
  ];
  if (f.category) parts.push(Prisma.sql`category = ${f.category}`);
  if (f.staffId)  parts.push(Prisma.sql`"staffId" = ${f.staffId}`);
  return parts.reduce((a, b) => Prisma.sql`${a} AND ${b}`);
}

/** Build a WHERE fragment with explicit `e.` table alias — for JOINed queries. */
function buildSqlWhereAliased(f: AnalyticsFilters): Prisma.Sql {
  const parts: Prisma.Sql[] = [
    Prisma.sql`e.date >= ${f.from}`,
    Prisma.sql`e.date <= ${f.to}`,
  ];
  if (f.category) parts.push(Prisma.sql`e.category = ${f.category}`);
  if (f.staffId)  parts.push(Prisma.sql`e."staffId" = ${f.staffId}`);
  return parts.reduce((a, b) => Prisma.sql`${a} AND ${b}`);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export interface SummaryData {
  totalAmount:    number;
  totalCount:     number;
  approvedAmount: number;
  approvedCount:  number;
  pendingAmount:  number;
  pendingCount:   number;
  rejectedAmount: number;
  rejectedCount:  number;
}

export async function getAnalyticsSummary(f: AnalyticsFilters): Promise<SummaryData> {
  const where = buildWhere(f);

  const [total, approved, pending, rejected] = await Promise.all([
    prisma.expense.aggregate({ where, _sum: { amount: true }, _count: true }),
    prisma.expense.aggregate({ where: { ...where, status: "APPROVED" }, _sum: { amount: true }, _count: true }),
    prisma.expense.aggregate({
      where: { ...where, status: { in: ["PENDING", "PENDING_ACCOUNTS", "PENDING_OWNER"] } },
      _sum: { amount: true }, _count: true,
    }),
    prisma.expense.aggregate({ where: { ...where, status: "REJECTED" }, _sum: { amount: true }, _count: true }),
  ]);

  return {
    totalAmount:    Number(total._sum.amount    ?? 0),
    totalCount:     total._count,
    approvedAmount: Number(approved._sum.amount ?? 0),
    approvedCount:  approved._count,
    pendingAmount:  Number(pending._sum.amount  ?? 0),
    pendingCount:   pending._count,
    rejectedAmount: Number(rejected._sum.amount ?? 0),
    rejectedCount:  rejected._count,
  };
}

// ---------------------------------------------------------------------------
// Category breakdown
// ---------------------------------------------------------------------------

export interface CategoryDataPoint {
  category: string;
  total:    number;
  count:    number;
}

export async function getAnalyticsByCategory(f: AnalyticsFilters): Promise<CategoryDataPoint[]> {
  const rows = await prisma.expense.groupBy({
    by:      ["category"],
    where:   buildWhere(f),
    _sum:    { amount: true },
    _count:  true,
    orderBy: { _sum: { amount: "desc" } },
  });

  return rows.map((r) => ({
    category: r.category,
    total:    Number(r._sum.amount ?? 0),
    count:    r._count,
  }));
}

// ---------------------------------------------------------------------------
// Monthly trend  (raw SQL — DATE_TRUNC is not available in Prisma groupBy)
// ---------------------------------------------------------------------------

export interface MonthlyDataPoint {
  month:    string;   // "Jan 2025"
  total:    number;
  approved: number;
  rejected: number;
  pending:  number;
}

export async function getAnalyticsMonthly(f: AnalyticsFilters): Promise<MonthlyDataPoint[]> {
  const where = buildSqlWhere(f);

  type RawRow = { month: string; total: number; approved: number; rejected: number; pending: number };

  const rows = await prisma.$queryRaw<RawRow[]>`
    SELECT
      TO_CHAR(DATE_TRUNC('month', date), 'Mon YYYY')  AS month,
      SUM(amount)::float                              AS total,
      SUM(CASE WHEN status = 'APPROVED'
               THEN amount ELSE 0 END)::float         AS approved,
      SUM(CASE WHEN status = 'REJECTED'
               THEN amount ELSE 0 END)::float         AS rejected,
      SUM(CASE WHEN status IN ('PENDING','PENDING_ACCOUNTS','PENDING_OWNER')
               THEN amount ELSE 0 END)::float         AS pending
    FROM "Expense"
    WHERE ${where}
    GROUP BY DATE_TRUNC('month', date)
    ORDER BY DATE_TRUNC('month', date) ASC
  `;

  return rows.map((r) => ({
    month:    r.month,
    total:    Number(r.total),
    approved: Number(r.approved),
    rejected: Number(r.rejected),
    pending:  Number(r.pending),
  }));
}

// ---------------------------------------------------------------------------
// Employee spend  (raw SQL — single query with JOIN + CASE WHEN)
// ---------------------------------------------------------------------------

export interface EmployeeDataPoint {
  staffId:  string;
  name:     string;
  total:    number;
  count:    number;
  approved: number;
  rejected: number;
  pending:  number;
}

export async function getAnalyticsByEmployee(f: AnalyticsFilters): Promise<EmployeeDataPoint[]> {
  const where = buildSqlWhereAliased(f);

  type RawRow = {
    staffId:  string;
    name:     string;
    total:    number;
    count:    number;
    approved: number;
    rejected: number;
    pending:  number;
  };

  const rows = await prisma.$queryRaw<RawRow[]>`
    SELECT
      e."staffId"                                                           AS "staffId",
      COALESCE(s."firstName" || ' ' || s."lastName", 'Unknown')            AS name,
      SUM(e.amount)::float                                                  AS total,
      COUNT(*)::int                                                         AS count,
      SUM(CASE WHEN e.status = 'APPROVED'
               THEN e.amount ELSE 0 END)::float                            AS approved,
      SUM(CASE WHEN e.status = 'REJECTED'
               THEN e.amount ELSE 0 END)::float                            AS rejected,
      SUM(CASE WHEN e.status IN ('PENDING','PENDING_ACCOUNTS','PENDING_OWNER')
               THEN e.amount ELSE 0 END)::float                            AS pending
    FROM "Expense" e
    LEFT JOIN "Staff" s ON s.id = e."staffId"
    WHERE e."staffId" IS NOT NULL AND ${where}
    GROUP BY e."staffId", s."firstName", s."lastName"
    ORDER BY total DESC
  `;

  return rows.map((r) => ({
    staffId:  r.staffId,
    name:     r.name,
    total:    Number(r.total),
    count:    Number(r.count),
    approved: Number(r.approved),
    rejected: Number(r.rejected),
    pending:  Number(r.pending),
  }));
}

// ---------------------------------------------------------------------------
// Rejection analysis
// ---------------------------------------------------------------------------

export interface RejectionDataPoint {
  reason: string;
  count:  number;
}

export async function getAnalyticsByRejection(f: AnalyticsFilters): Promise<RejectionDataPoint[]> {
  const rows = await prisma.expense.groupBy({
    by:      ["rejectionReason"],
    where:   { ...buildWhere(f), status: "REJECTED", rejectionReason: { not: null } },
    _count:  true,
    orderBy: { _count: { rejectionReason: "desc" } },
  });

  return rows
    .filter((r) => r.rejectionReason)
    .map((r) => ({ reason: r.rejectionReason!, count: r._count }));
}

// ---------------------------------------------------------------------------
// GPS locations
// ---------------------------------------------------------------------------

export interface LocationDataPoint {
  id:        string;
  lat:       number;
  lng:       number;
  amount:    number;
  isFlagged: boolean;
  category:  string;
  status:    string;
  staffName: string;
}

export async function getAnalyticsLocations(f: AnalyticsFilters): Promise<LocationDataPoint[]> {
  const rows = await prisma.expense.findMany({
    where: {
      ...buildWhere(f),
      gpsLat: { not: null },
      gpsLng: { not: null },
    },
    select: {
      id:        true,
      gpsLat:    true,
      gpsLng:    true,
      amount:    true,
      isFlagged: true,
      category:  true,
      status:    true,
      staff:     { select: { firstName: true, lastName: true } },
    },
    take: 500,   // cap to protect render performance
  });

  return rows
    .filter((r) => r.gpsLat !== null && r.gpsLng !== null)
    .map((r) => ({
      id:        r.id,
      lat:       r.gpsLat!,
      lng:       r.gpsLng!,
      amount:    Number(r.amount),
      isFlagged: r.isFlagged,
      category:  r.category,
      status:    r.status,
      staffName: r.staff ? `${r.staff.firstName} ${r.staff.lastName}` : "Unknown",
    }));
}
