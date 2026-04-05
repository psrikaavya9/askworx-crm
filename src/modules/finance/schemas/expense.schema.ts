import { z } from "zod";

// ---------------------------------------------------------------------------
// Create Expense
// ---------------------------------------------------------------------------

export const createExpenseSchema = z.object({
  staffId:     z.string().optional(),
  category:    z.string().min(1, "Category is required").max(100),
  amount:      z.coerce.number().positive("Amount must be positive"),
  description: z.string().min(10, "Description must be at least 10 characters").max(1000).optional(),
  receiptUrl:  z.string().url("Invalid URL").optional().or(z.literal("")),
  date:        z.coerce.date(),
  // Module 10 — Smart Expense Engine
  paymentMode: z.string().optional(),
  gpsLat:      z.number().optional(),
  gpsLng:      z.number().optional(),
  clientId:    z.string().optional(),
  projectId:   z.string().optional(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

// ---------------------------------------------------------------------------
// Expense list filters
// ---------------------------------------------------------------------------

export const expenseFiltersSchema = z.object({
  status: z.enum([
    "PENDING", "DRAFT", "VALIDATING", "AUTO_REJECTED",
    "PENDING_ACCOUNTS", "PENDING_OWNER", "APPROVED", "REJECTED", "REIMBURSED",
  ]).optional(),
  staffId: z.string().optional(),
  category: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  sortBy: z
    .enum(["createdAt", "date", "amount", "category"])
    .optional()
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

export type ExpenseFiltersInput = z.infer<typeof expenseFiltersSchema>;
