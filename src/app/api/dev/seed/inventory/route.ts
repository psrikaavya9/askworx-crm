import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const existing = await prisma.product.findFirst({ where: { sku: "LAP-001" } });
  if (existing) {
    return NextResponse.json({ message: "Inventory demo data already exists" });
  }

  // Create demo products
  const laptop = await prisma.product.create({
    data: {
      name: "Laptop",
      sku: "LAP-001",
      description: "14-inch business laptop with 16GB RAM and 512GB SSD",
      category: "Electronics",
      unitPrice: 75000,
      costPrice: 60000,
      stockQuantity: 0,
      minimumStock: 5,
    },
  });

  const chair = await prisma.product.create({
    data: {
      name: "Office Chair",
      sku: "CHR-001",
      description: "Ergonomic adjustable office chair with lumbar support",
      category: "Furniture",
      unitPrice: 12000,
      costPrice: 8000,
      stockQuantity: 0,
      minimumStock: 10,
    },
  });

  const ink = await prisma.product.create({
    data: {
      name: "Printer Ink Cartridge",
      sku: "INK-001",
      description: "Black ink cartridge compatible with HP, Canon printers",
      category: "Stationery",
      unitPrice: 800,
      costPrice: 400,
      stockQuantity: 0,
      minimumStock: 20,
    },
  });

  const mouse = await prisma.product.create({
    data: {
      name: "Wireless Mouse",
      sku: "MSE-001",
      description: "Ergonomic wireless optical mouse with USB receiver",
      category: "Electronics",
      unitPrice: 1500,
      costPrice: 900,
      stockQuantity: 0,
      minimumStock: 15,
    },
  });

  const desk = await prisma.product.create({
    data: {
      name: "Standing Desk",
      sku: "DSK-001",
      description: "Height-adjustable electric standing desk, 140x70cm",
      category: "Furniture",
      unitPrice: 35000,
      costPrice: 25000,
      stockQuantity: 0,
      minimumStock: 3,
    },
  });

  // Add stock movements using raw prisma to maintain correct stockQuantity
  // Laptop: IN 20, OUT 6 → 14 (above min 5)
  await prisma.stockMovement.create({ data: { productId: laptop.id, type: "IN", quantity: 20, reference: "PO-2026-001", notes: "Initial stock purchase" } });
  await prisma.product.update({ where: { id: laptop.id }, data: { stockQuantity: 20 } });
  await prisma.stockMovement.create({ data: { productId: laptop.id, type: "OUT", quantity: 6, reference: "SO-2026-010", notes: "Sold to client" } });
  await prisma.product.update({ where: { id: laptop.id }, data: { stockQuantity: 14 } });

  // Chair: IN 30, OUT 25 → 5 (equal to min 10, LOW_STOCK)
  await prisma.stockMovement.create({ data: { productId: chair.id, type: "IN", quantity: 30, reference: "PO-2026-002", notes: "Bulk purchase for office renovation" } });
  await prisma.product.update({ where: { id: chair.id }, data: { stockQuantity: 30 } });
  await prisma.stockMovement.create({ data: { productId: chair.id, type: "OUT", quantity: 25, reference: "SO-2026-011", notes: "Distributed to branches" } });
  await prisma.product.update({ where: { id: chair.id }, data: { stockQuantity: 5 } });

  // Ink: IN 100, ADJUSTMENT to 8 → LOW_STOCK (min 20)
  await prisma.stockMovement.create({ data: { productId: ink.id, type: "IN", quantity: 100, reference: "PO-2026-003", notes: "Quarterly stationery order" } });
  await prisma.product.update({ where: { id: ink.id }, data: { stockQuantity: 100 } });
  await prisma.stockMovement.create({ data: { productId: ink.id, type: "OUT", quantity: 92, reference: "SO-2026-012", notes: "Used by departments" } });
  await prisma.product.update({ where: { id: ink.id }, data: { stockQuantity: 8 } });
  await prisma.stockMovement.create({ data: { productId: ink.id, type: "ADJUSTMENT", quantity: 0, reference: "ADJ-2026-001", notes: "Physical count adjustment — found 0 extras" } });

  // Mouse: IN 50, OUT 10 → 40 (above min 15)
  await prisma.stockMovement.create({ data: { productId: mouse.id, type: "IN", quantity: 50, reference: "PO-2026-004", notes: "Initial purchase" } });
  await prisma.product.update({ where: { id: mouse.id }, data: { stockQuantity: 50 } });
  await prisma.stockMovement.create({ data: { productId: mouse.id, type: "OUT", quantity: 10, reference: "SO-2026-013", notes: "Issued to new employees" } });
  await prisma.product.update({ where: { id: mouse.id }, data: { stockQuantity: 40 } });

  // Desk: IN 2 → LOW_STOCK (min 3)
  await prisma.stockMovement.create({ data: { productId: desk.id, type: "IN", quantity: 2, reference: "PO-2026-005", notes: "Sample units" } });
  await prisma.product.update({ where: { id: desk.id }, data: { stockQuantity: 2 } });

  return NextResponse.json({
    message: "Inventory demo data created successfully",
    products: [laptop.name, chair.name, ink.name, mouse.name, desk.name],
  });
}
