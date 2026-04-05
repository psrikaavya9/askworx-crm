import { prisma } from "@/lib/prisma";
import type { Prisma, StockMovementType } from "@/generated/prisma/client";
import type { MovementFiltersInput } from "../schemas/stock.schema";
import type { PaginatedResult, StockMovementWithProduct } from "../types";

export async function createMovementAndUpdateStock(
  productId: string,
  type: StockMovementType,
  quantityDelta: number, // positive = increase, negative = decrease, 0 = replaced by newQty below
  newQuantity: number | null,
  reference?: string,
  notes?: string
) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUniqueOrThrow({ where: { id: productId } });

    const updatedQty =
      newQuantity !== null ? newQuantity : product.stockQuantity + quantityDelta;

    const [movement, updated] = await Promise.all([
      tx.stockMovement.create({
        data: {
          productId,
          type,
          quantity: Math.abs(quantityDelta !== 0 ? quantityDelta : newQuantity! - product.stockQuantity),
          reference,
          notes,
        },
      }),
      tx.product.update({
        where: { id: productId },
        data: { stockQuantity: updatedQty },
      }),
    ]);

    return { movement, product: updated };
  });
}

export async function findMovements(
  filters: MovementFiltersInput
): Promise<PaginatedResult<StockMovementWithProduct>> {
  const { page, pageSize, productId, type } = filters;
  const skip = (page - 1) * pageSize;

  const where: Prisma.StockMovementWhereInput = {};
  if (productId) where.productId = productId;
  if (type) where.type = type;

  const [data, total] = await prisma.$transaction([
    prisma.stockMovement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        product: { select: { id: true, name: true, sku: true } },
      },
    }),
    prisma.stockMovement.count({ where }),
  ]);

  return {
    data: data as StockMovementWithProduct[],
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getInventoryKPI() {
  const [products, recentMovementsCount] = await Promise.all([
    prisma.product.findMany({ select: { stockQuantity: true, costPrice: true, minimumStock: true } }),
    prisma.stockMovement.count({
      where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    }),
  ]);

  const totalProducts = products.length;
  const lowStock = products.filter((p) => p.stockQuantity <= p.minimumStock).length;
  const totalInventoryValue = products.reduce(
    (sum, p) => sum + p.stockQuantity * Number(p.costPrice),
    0
  );

  return {
    totalProducts,
    lowStockItems: lowStock,
    totalInventoryValue,
    recentMovementsCount,
  };
}
