import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { CreateProductInput, UpdateProductInput, ProductFiltersInput } from "../schemas/product.schema";
import type { PaginatedResult } from "../types";
import type { Product } from "@/generated/prisma/client";

function buildWhereClause(filters: Partial<ProductFiltersInput>): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {};

  if (filters.category) where.category = filters.category;

  if (filters.search) {
    const s = filters.search.trim();
    where.OR = [
      { name: { contains: s, mode: "insensitive" } },
      { sku: { contains: s, mode: "insensitive" } },
      { category: { contains: s, mode: "insensitive" } },
      { description: { contains: s, mode: "insensitive" } },
    ];
  }

  // stockStatus filter applied post-query via minimumStock comparison
  // Prisma supports column comparison via raw or computed — use lte for LOW_STOCK
  if (filters.stockStatus === "LOW_STOCK") {
    where.stockQuantity = { lte: prisma.product.fields.minimumStock as unknown as number };
  }

  return where;
}

export async function findProducts(filters: ProductFiltersInput): Promise<PaginatedResult<Product>> {
  const { page, pageSize, sortBy, sortOrder, stockStatus } = filters;
  const skip = (page - 1) * pageSize;

  // Build base where (excluding stockStatus — handled via raw filter)
  const baseWhere: Prisma.ProductWhereInput = {};

  if (filters.category) baseWhere.category = filters.category;

  if (filters.search) {
    const s = filters.search.trim();
    baseWhere.OR = [
      { name: { contains: s, mode: "insensitive" } },
      { sku: { contains: s, mode: "insensitive" } },
      { category: { contains: s, mode: "insensitive" } },
      { description: { contains: s, mode: "insensitive" } },
    ];
  }

  // Fetch all matching (without stockStatus filter) then filter in memory
  // for LOW_STOCK since Prisma doesn't support column-to-column comparison directly
  const all = await prisma.product.findMany({
    where: baseWhere,
    orderBy: { [sortBy]: sortOrder },
  });

  const filtered = stockStatus
    ? all.filter((p) =>
        stockStatus === "LOW_STOCK"
          ? p.stockQuantity <= p.minimumStock
          : p.stockQuantity > p.minimumStock
      )
    : all;

  const total = filtered.length;
  const data = filtered.slice(skip, skip + pageSize);

  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function findProductById(id: string) {
  return prisma.product.findUnique({
    where: { id },
    include: {
      movements: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });
}

export async function findProductBySku(sku: string) {
  return prisma.product.findUnique({ where: { sku } });
}

export async function createProduct(data: CreateProductInput) {
  return prisma.product.create({ data });
}

export async function updateProduct(id: string, data: UpdateProductInput) {
  return prisma.product.update({ where: { id }, data });
}

export async function deleteProduct(id: string) {
  return prisma.product.delete({ where: { id } });
}

export async function findAllCategories(): Promise<string[]> {
  const result = await prisma.product.findMany({
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  });
  return result.map((r) => r.category);
}
