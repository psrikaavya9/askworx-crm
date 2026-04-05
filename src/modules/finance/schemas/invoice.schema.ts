import { z } from "zod";

// ---------------------------------------------------------------------------
// Invoice Item
// ---------------------------------------------------------------------------

export const invoiceItemSchema = z.object({
  description: z.string().min(1, "Description is required").max(500),
  quantity: z.coerce.number().positive("Quantity must be positive"),
  unitPrice: z.coerce.number().min(0, "Unit price must be non-negative"),
});

export type InvoiceItemInput = z.infer<typeof invoiceItemSchema>;

// ---------------------------------------------------------------------------
// Create Invoice
// ---------------------------------------------------------------------------

export const createInvoiceSchema = z.object({
  invoiceNumber: z.string().min(1, "Invoice number is required").max(50),
  clientId: z.string().min(1, "Client is required"),
  projectId: z.string().optional(),
  issueDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  cgst: z.coerce.number().min(0).optional().default(0),
  sgst: z.coerce.number().min(0).optional().default(0),
  igst: z.coerce.number().min(0).optional().default(0),
  notes: z.string().max(2000).optional(),
  items: z.array(invoiceItemSchema).min(1, "At least one item is required"),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

// ---------------------------------------------------------------------------
// Update Invoice
// ---------------------------------------------------------------------------

export const updateInvoiceSchema = z.object({
  clientId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  issueDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
  cgst: z.coerce.number().min(0).optional(),
  sgst: z.coerce.number().min(0).optional(),
  igst: z.coerce.number().min(0).optional(),
  notes: z.string().max(2000).optional().nullable(),
  status: z.enum(["DRAFT", "SENT", "PAID", "OVERDUE"]).optional(),
  items: z.array(invoiceItemSchema).min(1).optional(),
});

export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;

// ---------------------------------------------------------------------------
// Invoice list filters
// ---------------------------------------------------------------------------

export const invoiceFiltersSchema = z.object({
  status: z.enum(["DRAFT", "SENT", "PAID", "OVERDUE"]).optional(),
  clientId: z.string().optional(),
  projectId: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  sortBy: z
    .enum(["createdAt", "issueDate", "dueDate", "totalAmount", "invoiceNumber"])
    .optional()
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

export type InvoiceFiltersInput = z.infer<typeof invoiceFiltersSchema>;
