import { z } from "zod";

export const createProductSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sku: z.string().min(1, "SKU is required"),
  description: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  unitPrice: z.coerce.number().min(0, "Unit price must be non-negative"),
  costPrice: z.coerce.number().min(0, "Cost price must be non-negative"),
  unit: z.string().optional().default("pcs"),
  stockQuantity: z.coerce.number().int().min(0).default(0),
  minimumStock: z.coerce.number().int().min(0).default(0),
});

export const updateProductSchema = createProductSchema.partial();

export const productFiltersSchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  stockStatus: z.enum(["IN_STOCK", "LOW_STOCK"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z
    .enum(["name", "sku", "category", "stockQuantity", "unitPrice", "createdAt"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductFiltersInput = z.infer<typeof productFiltersSchema>;
