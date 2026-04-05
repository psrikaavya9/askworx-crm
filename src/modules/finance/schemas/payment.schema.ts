import { z } from "zod";

// ---------------------------------------------------------------------------
// Record Payment
// ---------------------------------------------------------------------------

export const recordPaymentSchema = z.object({
  invoiceId: z.string().min(1, "Invoice ID is required"),
  amount: z.coerce.number().positive("Amount must be positive"),
  paymentDate: z.coerce.date(),
  paymentMethod: z.enum(["CASH", "BANK", "UPI", "CARD"]),
  referenceNumber: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

// ---------------------------------------------------------------------------
// Payment filters
// ---------------------------------------------------------------------------

export const paymentFiltersSchema = z.object({
  invoiceId: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type PaymentFiltersInput = z.infer<typeof paymentFiltersSchema>;
