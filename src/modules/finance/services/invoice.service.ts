import { prisma } from "@/lib/prisma";
import * as invoiceRepo from "../repositories/invoice.repository";
import type { CreateInvoiceInput, UpdateInvoiceInput, InvoiceFiltersInput } from "../schemas/invoice.schema";

// ---------------------------------------------------------------------------
// Invoice CRUD
// ---------------------------------------------------------------------------

export async function getInvoices(filters: InvoiceFiltersInput) {
  return invoiceRepo.findInvoices(filters);
}

export async function getInvoiceById(id: string) {
  const invoice = await invoiceRepo.findInvoiceById(id);
  if (!invoice) throw new Error(`Invoice not found: ${id}`);
  return invoice;
}

export async function createInvoice(data: CreateInvoiceInput) {
  const existing = await invoiceRepo.findInvoiceByNumber(data.invoiceNumber);
  if (existing) throw new Error(`Invoice number "${data.invoiceNumber}" already exists.`);

  if (data.dueDate < data.issueDate) {
    throw new Error("Due date must be on or after the issue date.");
  }

  const client = await prisma.client.findUnique({ where: { id: data.clientId } });
  if (!client) throw new Error(`Client not found: ${data.clientId}`);

  if (data.projectId) {
    const project = await prisma.project.findUnique({ where: { id: data.projectId } });
    if (!project) throw new Error(`Project not found: ${data.projectId}`);
  }

  return invoiceRepo.createInvoice(data);
}

export async function updateInvoice(id: string, data: UpdateInvoiceInput) {
  const existing = await getInvoiceById(id);

  if (data.issueDate && data.dueDate && data.dueDate < data.issueDate) {
    throw new Error("Due date must be on or after the issue date.");
  }

  // Validate clientId if it is being changed
  if (data.clientId && data.clientId !== existing.clientId) {
    const client = await prisma.client.findUnique({ where: { id: data.clientId } });
    if (!client) throw new Error(`Client not found: ${data.clientId}`);
  }

  // Validate projectId if it is being set or changed
  if (data.projectId && data.projectId !== existing.projectId) {
    const project = await prisma.project.findUnique({ where: { id: data.projectId } });
    if (!project) throw new Error(`Project not found: ${data.projectId}`);
  }

  return invoiceRepo.updateInvoice(id, data);
}

// ---------------------------------------------------------------------------
// Mark Paid
// ---------------------------------------------------------------------------

export async function markInvoicePaid(id: string) {
  await getInvoiceById(id);
  return invoiceRepo.markInvoiceStatus(id, "PAID");
}

export async function markInvoiceSent(id: string) {
  await getInvoiceById(id);
  return invoiceRepo.markInvoiceStatus(id, "SENT");
}

export async function deleteInvoice(id: string) {
  await getInvoiceById(id);
  return invoiceRepo.deleteInvoice(id);
}
