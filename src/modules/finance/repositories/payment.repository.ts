import { prisma } from "@/lib/prisma";
import type { RecordPaymentInput, PaymentFiltersInput } from "../schemas/payment.schema";

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function findPaymentsByInvoice(invoiceId: string) {
  return prisma.payment.findMany({
    where: { invoiceId },
    orderBy: { paymentDate: "desc" },
  });
}

export async function findPayments(filters: PaymentFiltersInput) {
  const { page, pageSize, invoiceId } = filters;
  const skip = (page - 1) * pageSize;

  const where = invoiceId ? { invoiceId } : {};

  const data = await prisma.payment.findMany({
    where,
    orderBy: { paymentDate: "desc" },
    skip,
    take: pageSize,
  });
  const total = await prisma.payment.count({ where });

  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

export async function createPayment(data: RecordPaymentInput) {
  return prisma.payment.create({ data });
}

export async function sumPaymentsForInvoice(invoiceId: string): Promise<number> {
  const result = await prisma.payment.aggregate({
    where: { invoiceId },
    _sum: { amount: true },
  });
  return Number(result._sum.amount ?? 0);
}
