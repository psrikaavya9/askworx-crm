import * as paymentRepo from "../repositories/payment.repository";
import * as invoiceRepo from "../repositories/invoice.repository";
import type { RecordPaymentInput, PaymentFiltersInput } from "../schemas/payment.schema";

// ---------------------------------------------------------------------------
// Payment CRUD
// ---------------------------------------------------------------------------

export async function recordPayment(data: RecordPaymentInput) {
  const invoice = await invoiceRepo.findInvoiceById(data.invoiceId);
  if (!invoice) throw new Error(`Invoice not found: ${data.invoiceId}`);

  const payment = await paymentRepo.createPayment(data);

  // Auto-mark invoice as PAID if total payments >= totalAmount
  const totalPaid = await paymentRepo.sumPaymentsForInvoice(data.invoiceId);
  if (totalPaid >= Number(invoice.totalAmount)) {
    await invoiceRepo.markInvoiceStatus(data.invoiceId, "PAID");
  }

  return payment;
}

export async function getPaymentsByInvoice(invoiceId: string) {
  return paymentRepo.findPaymentsByInvoice(invoiceId);
}

export async function getPayments(filters: PaymentFiltersInput) {
  return paymentRepo.findPayments(filters);
}
