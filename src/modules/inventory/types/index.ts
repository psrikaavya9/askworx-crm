import type { Product, StockMovement, StockMovementType } from "@/generated/prisma/client";

export type { StockMovementType };

export type StockStatus = "IN_STOCK" | "LOW_STOCK";

export interface ProductWithStatus extends Product {
  stockStatus: StockStatus;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ProductKPI {
  totalProducts: number;
  lowStockItems: number;
  totalInventoryValue: number;
  recentMovementsCount: number;
}

export interface StockMovementWithProduct extends StockMovement {
  product: Pick<Product, "id" | "name" | "sku">;
}

export function getStockStatus(product: Pick<Product, "stockQuantity" | "minimumStock">): StockStatus {
  return product.stockQuantity <= product.minimumStock ? "LOW_STOCK" : "IN_STOCK";
}
