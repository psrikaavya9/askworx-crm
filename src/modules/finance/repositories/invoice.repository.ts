import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { CreateInvoiceInput, UpdateInvoiceInput, InvoiceFiltersInput } from "../schemas/invoice.schema";
import type { PaginatedResult, InvoiceWithItems } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const invoiceInclude = {
  items: true,
  payments: true,
  client: { select: { id: true, firstName: true, lastName: true, company: true } },
  project: { select: { id: true, name: true } },
} satisfies Prisma.InvoiceInclude;

function buildWhere(filters: Partial<InvoiceFiltersInput>): Prisma.InvoiceWhereInput {
  const where: Prisma.InvoiceWhereInput = {};

  if (filters.status) where.status = filters.status;
  if (filters.clientId) where.clientId = filters.clientId;
  if (filters.projectId) where.projectId = filters.projectId;

  if (filters.search) {
    const s = filters.search.trim();
    where.invoiceNumber = { contains: s, mode: "insensitive" };
  }

  return where;
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function findInvoices(filters: InvoiceFiltersInput): Promise<PaginatedResult<InvoiceWithItems>> {
  const { page, pageSize, sortBy, sortOrder } = filters;
  const where = buildWhere(filters);
  const skip = (page - 1) * pageSize;

  const data = await prisma.invoice.findMany({
    where,
    include: invoiceInclude,
    orderBy: { [sortBy]: sortOrder },
    skip,
    take: pageSize,
  });
  const total = await prisma.invoice.count({ where });

  return {
    data: data as unknown as InvoiceWithItems[],
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function findInvoiceById(id: string) {
  return prisma.invoice.findUnique({ where: { id }, include: invoiceInclude });
}

export async function findInvoiceByNumber(invoiceNumber: string) {
  return prisma.invoice.findUnique({ where: { invoiceNumber } });
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

export async function createInvoice(data: CreateInvoiceInput) {
  const subtotal = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const cgst = data.cgst ?? 0;
  const sgst = data.sgst ?? 0;
  const igst = data.igst ?? 0;
  const totalTax = cgst + sgst + igst;
  const totalAmount = subtotal + totalTax;

  return prisma.invoice.create({
    data: {
      invoiceNumber: data.invoiceNumber,
      clientId: data.clientId,
      projectId: data.projectId,
      issueDate: data.issueDate,
      dueDate: data.dueDate,
      subtotal,
      cgst,
      sgst,
      igst,
      totalTax,
      totalAmount,
      notes: data.notes,
      items: {
        create: data.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.quantity * item.unitPrice,
        })),
      },
    },
    include: invoiceInclude,
  });
}

export async function updateInvoice(id: string, data: UpdateInvoiceInput) {
  let subtotalUpdate: number | undefined;
  let totalAmountUpdate: number | undefined;

  const updateData: Prisma.InvoiceUpdateInput = {};

  if (data.clientId) updateData.client = { connect: { id: data.clientId } };
  if (data.projectId !== undefined) updateData.project = data.projectId ? { connect: { id: data.projectId } } : { disconnect: true };
  if (data.issueDate !== undefined) updateData.issueDate = data.issueDate;
  if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.status !== undefined) updateData.status = data.status;

  if (data.items) {
    subtotalUpdate = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const cgst = data.cgst ?? 0;
    const sgst = data.sgst ?? 0;
    const igst = data.igst ?? 0;
    const totalTax = cgst + sgst + igst;
    totalAmountUpdate = subtotalUpdate + totalTax;

    updateData.subtotal = subtotalUpdate;
    updateData.cgst = cgst;
    updateData.sgst = sgst;
    updateData.igst = igst;
    updateData.totalTax = totalTax;
    updateData.totalAmount = totalAmountUpdate;

    updateData.items = {
      deleteMany: {},
      create: data.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.quantity * item.unitPrice,
      })),
    };
  } else if (data.cgst !== undefined || data.sgst !== undefined || data.igst !== undefined) {
    // GST fields changed without items — re-fetch current subtotal to recalculate totalAmount
    const current = await prisma.invoice.findUniqueOrThrow({ where: { id }, select: { subtotal: true, cgst: true, sgst: true, igst: true } });
    const cgst = data.cgst ?? Number(current.cgst);
    const sgst = data.sgst ?? Number(current.sgst);
    const igst = data.igst ?? Number(current.igst);
    const totalTax = cgst + sgst + igst;
    updateData.cgst = cgst;
    updateData.sgst = sgst;
    updateData.igst = igst;
    updateData.totalTax = totalTax;
    updateData.totalAmount = Number(current.subtotal) + totalTax;
  }

  return prisma.invoice.update({ where: { id }, data: updateData, include: invoiceInclude });
}

export async function markInvoiceStatus(id: string, status: "DRAFT" | "SENT" | "PAID" | "OVERDUE") {
  return prisma.invoice.update({ where: { id }, data: { status } });
}

export async function deleteInvoice(id: string) {
  return prisma.invoice.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// KPI helpers
// ---------------------------------------------------------------------------

export async function getInvoiceKpiData() {
  const [paid, outstanding, overdue, total] = await Promise.all([
    prisma.invoice.aggregate({
      where: { status: "PAID" },
      _sum: { totalAmount: true },
      _count: true,
    }),
    prisma.invoice.aggregate({
      where: { status: { in: ["SENT", "DRAFT"] } },
      _sum: { totalAmount: true },
      _count: true,
    }),
    prisma.invoice.count({ where: { status: "OVERDUE" } }),
    prisma.invoice.count(),
  ]);

  return { paid, outstanding, overdue, total };
}

export async function getRevenueGroupedByClient() {
  return prisma.invoice.groupBy({
    by: ["clientId"],
    where: { status: { in: ["PAID", "SENT"] } },
    _sum: { totalAmount: true },
  });
}
