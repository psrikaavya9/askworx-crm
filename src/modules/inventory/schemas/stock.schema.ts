import { z } from "zod";

export const addStockSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

export const removeStockSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

export const adjustStockSchema = z.object({
  productId: z.string().min(1),
  newQuantity: z.coerce.number().int().min(0, "Quantity must be non-negative"),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

export const movementFiltersSchema = z.object({
  productId: z.string().optional(),
  type: z.enum(["IN", "OUT", "ADJUSTMENT"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type AddStockInput = z.infer<typeof addStockSchema>;
export type RemoveStockInput = z.infer<typeof removeStockSchema>;
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
export type MovementFiltersInput = z.infer<typeof movementFiltersSchema>;
