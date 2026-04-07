/**
 * seed-inventory.ts
 *
 * Idempotent seed for the Inventory module:
 *   1. 10 products with realistic stock variation
 *      • 3 LOW  stock  (stockQuantity < minimumStock)  → appear in alerts panel
 *      • 3 MED  stock  (minimumStock < qty < 2×min)
 *      • 4 HIGH stock  (qty > 2×minimumStock)
 *   2. Stock movements (IN / OUT) per product — purchase + sales history
 *
 * Run: npx tsx prisma/seed-inventory.ts
 */

import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new (PrismaClient as any)({ adapter }) as PrismaClient;

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

// ─── PRODUCT DEFINITIONS ───────────────────────────────────────────────────
// stockLevel: "LOW" | "MED" | "HIGH"
// LOW  → stockQuantity ≤ minimumStock  → shows in low-stock alert chart
// MED  → minimumStock < qty < 2×min   → healthy but watch
// HIGH → qty > 2×min                  → well-stocked

const PRODUCTS = [
  // ── LOW STOCK (3) ─────────────────────────────────────────────────────────
  {
    name:          "Attendance QR Scanner",
    sku:           "QR-SCN-002",
    description:   "Wall-mounted QR code scanner for office attendance tracking.",
    category:      "Hardware",
    unitPrice:     4500,
    costPrice:     2200,
    unit:          "pcs",
    minimumStock:  10,
    stockQuantity: 3,   // LOW — 3 below threshold of 10
    level:         "LOW",
    movements: [
      { type: "IN"  as const, qty: 20, ref: "PO-2026-001", note: "Initial stock purchase", daysAgo: 90 },
      { type: "OUT" as const, qty: 8,  ref: "SO-2026-012", note: "Dispatch to Delhi office", daysAgo: 45 },
      { type: "OUT" as const, qty: 9,  ref: "SO-2026-028", note: "Dispatch to Mumbai branch", daysAgo: 12 },
    ],
  },
  {
    name:          "Field Staff GPS Tracker",
    sku:           "GPS-TRK-001",
    description:   "Compact GPS tracker device for field staff location monitoring.",
    category:      "Hardware",
    unitPrice:     3200,
    costPrice:     1600,
    unit:          "pcs",
    minimumStock:  15,
    stockQuantity: 4,   // LOW — 4 below threshold of 15
    level:         "LOW",
    movements: [
      { type: "IN"  as const, qty: 30, ref: "PO-2026-003", note: "Q1 purchase order", daysAgo: 120 },
      { type: "OUT" as const, qty: 12, ref: "SO-2026-018", note: "Field team deployment", daysAgo: 60 },
      { type: "OUT" as const, qty: 14, ref: "SO-2026-035", note: "New branch rollout", daysAgo: 8 },
    ],
  },
  {
    name:          "Thermal Receipt Printer",
    sku:           "PRT-THM-001",
    description:   "80mm thermal receipt printer for POS counters.",
    category:      "Hardware",
    unitPrice:     5800,
    costPrice:     3100,
    unit:          "pcs",
    minimumStock:  8,
    stockQuantity: 2,   // LOW — 2 below threshold of 8
    level:         "LOW",
    movements: [
      { type: "IN"  as const, qty: 15, ref: "PO-2026-007", note: "Annual hardware refresh", daysAgo: 180 },
      { type: "OUT" as const, qty: 7,  ref: "SO-2026-022", note: "Retail outlet installations", daysAgo: 90 },
      { type: "OUT" as const, qty: 6,  ref: "SO-2026-041", note: "Franchise kit dispatch", daysAgo: 5 },
    ],
  },

  // ── MED STOCK (3) ─────────────────────────────────────────────────────────
  {
    name:          "Laptop Stand Adjustable",
    sku:           "HW-STD-001",
    description:   "Aluminium ergonomic laptop stand, height adjustable, for 11–17 inch laptops.",
    category:      "Office Supplies",
    unitPrice:     1800,
    costPrice:     850,
    unit:          "pcs",
    minimumStock:  20,
    stockQuantity: 28,  // MED — 28, min is 20
    level:         "MED",
    movements: [
      { type: "IN"  as const, qty: 50, ref: "PO-2026-010", note: "Bulk order for new office", daysAgo: 60 },
      { type: "OUT" as const, qty: 22, ref: "SO-2026-031", note: "Staff workstation setup", daysAgo: 30 },
    ],
  },
  {
    name:          "HDMI Cable 2m",
    sku:           "CBL-HDM-002",
    description:   "HDMI 2.1 cable, 2 metres, supports 4K@60Hz for conference room setups.",
    category:      "Office Supplies",
    unitPrice:     350,
    costPrice:     120,
    unit:          "pcs",
    minimumStock:  30,
    stockQuantity: 45,  // MED — 45, min is 30
    level:         "MED",
    movements: [
      { type: "IN"  as const, qty: 100, ref: "PO-2026-012", note: "Bulk cable purchase", daysAgo: 75 },
      { type: "OUT" as const, qty: 40,  ref: "SO-2026-039", note: "Conference room project", daysAgo: 20 },
      { type: "OUT" as const, qty: 15,  ref: "SO-2026-044", note: "Staff requests", daysAgo: 3  },
    ],
  },
  {
    name:          "Wireless Keyboard & Mouse Combo",
    sku:           "KBD-WLS-001",
    description:   "2.4GHz wireless keyboard and mouse combo, 12-month battery life.",
    category:      "Hardware",
    unitPrice:     1200,
    costPrice:     580,
    unit:          "set",
    minimumStock:  15,
    stockQuantity: 22,  // MED — 22, min is 15
    level:         "MED",
    movements: [
      { type: "IN"  as const, qty: 40, ref: "PO-2026-015", note: "Q1 hardware budget", daysAgo: 50 },
      { type: "OUT" as const, qty: 18, ref: "SO-2026-033", note: "New employee kits", daysAgo: 25 },
    ],
  },

  // ── HIGH STOCK (4) ────────────────────────────────────────────────────────
  {
    name:          "CRM Pro Software License",
    sku:           "CRM-PRO-001",
    description:   "ASKworX CRM Pro annual licence — per seat, includes updates and support.",
    category:      "Software",
    unitPrice:     12000,
    costPrice:     6000,
    unit:          "license",
    minimumStock:  5,
    stockQuantity: 120, // HIGH
    level:         "HIGH",
    movements: [
      { type: "IN"  as const, qty: 150, ref: "PO-2026-020", note: "Annual licence batch", daysAgo: 30 },
      { type: "OUT" as const, qty: 20,  ref: "SO-2026-050", note: "Enterprise client A",  daysAgo: 15 },
      { type: "OUT" as const, qty: 10,  ref: "SO-2026-055", note: "SMB client B",         daysAgo: 5  },
    ],
  },
  {
    name:          "A4 Copy Paper (500 sheets)",
    sku:           "PPR-A4-001",
    description:   "Premium 80gsm A4 copy paper, 500 sheets per ream.",
    category:      "Office Supplies",
    unitPrice:     280,
    costPrice:     180,
    unit:          "ream",
    minimumStock:  20,
    stockQuantity: 180, // HIGH
    level:         "HIGH",
    movements: [
      { type: "IN"  as const, qty: 200, ref: "PO-2026-022", note: "Q1 stationery order",  daysAgo: 45 },
      { type: "OUT" as const, qty: 10,  ref: "SO-2026-060", note: "Monthly consumption",  daysAgo: 30 },
      { type: "OUT" as const, qty: 10,  ref: "SO-2026-065", note: "Monthly consumption",  daysAgo: 10 },
    ],
  },
  {
    name:          "Hand Sanitiser 500ml",
    sku:           "SAN-HND-001",
    description:   "70% isopropyl alcohol hand sanitiser, 500ml pump bottle.",
    category:      "Office Supplies",
    unitPrice:     120,
    costPrice:     60,
    unit:          "bottle",
    minimumStock:  25,
    stockQuantity: 95,  // HIGH
    level:         "HIGH",
    movements: [
      { type: "IN"  as const, qty: 120, ref: "PO-2026-025", note: "Annual hygiene stock",  daysAgo: 60 },
      { type: "OUT" as const, qty: 15,  ref: "SO-2026-070", note: "Floor distribution",    daysAgo: 30 },
      { type: "OUT" as const, qty: 10,  ref: "SO-2026-075", note: "Floor distribution",    daysAgo: 5  },
    ],
  },
  {
    name:          "Ballpoint Pen (Box of 50)",
    sku:           "PEN-BLK-001",
    description:   "Black ink ballpoint pen, 0.7mm tip, box of 50.",
    category:      "Office Supplies",
    unitPrice:     250,
    costPrice:     90,
    unit:          "box",
    minimumStock:  10,
    stockQuantity: 85,  // HIGH
    level:         "HIGH",
    movements: [
      { type: "IN"  as const, qty: 100, ref: "PO-2026-028", note: "Annual stationery bulk",  daysAgo: 90 },
      { type: "OUT" as const, qty: 8,   ref: "SO-2026-080", note: "Monthly desk replenish",  daysAgo: 45 },
      { type: "OUT" as const, qty: 7,   ref: "SO-2026-085", note: "Monthly desk replenish",  daysAgo: 10 },
    ],
  },
];

// ─── MAIN ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🚀 seed-inventory: starting...\n");

  const existingSkus = new Set(
    (await prisma.product.findMany({ select: { sku: true } })).map((p) => p.sku)
  );

  let productsCreated  = 0;
  let movementsCreated = 0;
  let lowCount = 0, medCount = 0, highCount = 0;

  for (const def of PRODUCTS) {
    if (existingSkus.has(def.sku)) {
      console.log(`   ⏭  SKU ${def.sku} already exists — skipping`);
      continue;
    }

    // Create product
    const product = await prisma.product.create({
      data: {
        name:          def.name,
        sku:           def.sku,
        description:   def.description,
        category:      def.category,
        unitPrice:     def.unitPrice,
        costPrice:     def.costPrice,
        unit:          def.unit,
        minimumStock:  def.minimumStock,
        stockQuantity: def.stockQuantity,
      },
    });
    productsCreated++;

    if (def.level === "LOW")  lowCount++;
    if (def.level === "MED")  medCount++;
    if (def.level === "HIGH") highCount++;

    // Create movements with realistic past dates
    for (const m of def.movements) {
      await prisma.stockMovement.create({
        data: {
          productId: product.id,
          type:      m.type,
          quantity:  m.qty,
          reference: m.ref,
          notes:     m.note,
          createdAt: daysAgo(m.daysAgo),
        },
      });
      movementsCreated++;
    }

    const icon = def.level === "LOW" ? "🔴" : def.level === "MED" ? "🟡" : "🟢";
    console.log(
      `   ${icon} [${def.level}] "${def.name}" — qty:${def.stockQuantity} min:${def.minimumStock} ` +
      `(${def.movements.length} movements)`
    );
  }

  // ── SUMMARY ───────────────────────────────────────────────────────────────
  const [totalProducts, totalMovements, alertCount] = await Promise.all([
    prisma.product.count(),
    prisma.stockMovement.count(),
    prisma.product.count({ where: { stockQuantity: { lte: prisma.product.fields.minimumStock } } }).catch(() =>
      // Fallback: manual count
      prisma.product.findMany({ select: { stockQuantity: true, minimumStock: true } }).then(
        (ps) => ps.filter((p) => p.stockQuantity <= p.minimumStock).length
      )
    ),
  ]);

  console.log("\n─────────────────────────────────────");
  console.log(`✅ Products created   : ${productsCreated}`);
  console.log(`   🔴 Low stock       : ${lowCount}`);
  console.log(`   🟡 Medium stock    : ${medCount}`);
  console.log(`   🟢 High stock      : ${highCount}`);
  console.log(`✅ Movements created  : ${movementsCreated}`);
  console.log(`\n📊 Database totals:`);
  console.log(`   Products     : ${totalProducts}`);
  console.log(`   Movements    : ${totalMovements}`);
  console.log(`   Low stock 🔴 : ${alertCount}`);
  console.log("\n🎉 seed-inventory done!\n");
}

main()
  .catch((e) => {
    console.error("❌ seed-inventory failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
