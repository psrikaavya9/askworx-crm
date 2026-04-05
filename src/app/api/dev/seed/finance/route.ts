import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/dev/seed/finance
 * Creates demo invoices, payments, and expenses.
 * Idempotent — skips if invoice numbers already exist.
 */
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  // Ensure we have at least one client and staff to reference
  const client = await prisma.client.findFirst({ orderBy: { createdAt: "asc" } });
  const staff = await prisma.staff.findFirst({ where: { status: "ACTIVE" } });

  const created: string[] = [];
  const skipped: string[] = [];

  // Demo invoices
  const demoInvoices = [
    {
      invoiceNumber: "INV-2026-001",
      issueDate: new Date("2026-01-15"),
      dueDate: new Date("2026-02-15"),
      cgst: 900,
      sgst: 900,
      igst: 0,
      notes: "Website redesign project — Phase 1",
      status: "PAID" as const,
      items: [
        { description: "UI/UX Design", quantity: 1, unitPrice: 5000 },
        { description: "Frontend Development", quantity: 40, unitPrice: 100 },
      ],
    },
    {
      invoiceNumber: "INV-2026-002",
      issueDate: new Date("2026-02-01"),
      dueDate: new Date("2026-03-01"),
      cgst: 450,
      sgst: 450,
      igst: 0,
      notes: "Monthly retainer — February",
      status: "SENT" as const,
      items: [
        { description: "Monthly Maintenance Retainer", quantity: 1, unitPrice: 5000 },
      ],
    },
    {
      invoiceNumber: "INV-2026-003",
      issueDate: new Date("2026-01-01"),
      dueDate: new Date("2026-02-01"),
      cgst: 180,
      sgst: 180,
      igst: 0,
      notes: "SEO Consulting",
      status: "OVERDUE" as const,
      items: [
        { description: "SEO Audit & Strategy", quantity: 1, unitPrice: 2000 },
      ],
    },
    {
      invoiceNumber: "INV-2026-004",
      issueDate: new Date("2026-03-01"),
      dueDate: new Date("2026-04-01"),
      cgst: 0,
      sgst: 0,
      igst: 720,
      notes: "Mobile app — Draft estimate",
      status: "DRAFT" as const,
      items: [
        { description: "React Native App Development", quantity: 80, unitPrice: 100 },
      ],
    },
  ];

  if (!client) {
    return NextResponse.json({ error: "No client found. Seed clients first." }, { status: 400 });
  }

  for (const inv of demoInvoices) {
    const existing = await prisma.invoice.findUnique({ where: { invoiceNumber: inv.invoiceNumber } });
    if (existing) {
      skipped.push(inv.invoiceNumber);
      continue;
    }

    const subtotal = inv.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const totalTax = inv.cgst + inv.sgst + inv.igst;
    const totalAmount = subtotal + totalTax;

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: inv.invoiceNumber,
        clientId: client.id,
        issueDate: inv.issueDate,
        dueDate: inv.dueDate,
        subtotal,
        cgst: inv.cgst,
        sgst: inv.sgst,
        igst: inv.igst,
        totalTax,
        totalAmount,
        status: inv.status,
        notes: inv.notes,
        items: {
          create: inv.items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.quantity * item.unitPrice,
          })),
        },
      },
    });

    // Add payment for paid invoice
    if (inv.status === "PAID") {
      await prisma.payment.create({
        data: {
          invoiceId: invoice.id,
          amount: totalAmount,
          paymentDate: new Date("2026-02-10"),
          paymentMethod: "BANK",
          referenceNumber: "TXN-20260210-001",
          notes: "Full payment received",
        },
      });
    }

    created.push(inv.invoiceNumber);
  }

  // Demo expenses
  const demoExpenses = [
    {
      category: "Software",
      amount: 2999,
      description: "Annual Figma subscription",
      date: new Date("2026-01-10"),
      status: "APPROVED" as const,
    },
    {
      category: "Travel",
      amount: 4500,
      description: "Client visit — Mumbai to Delhi flight + hotel",
      date: new Date("2026-02-14"),
      status: "APPROVED" as const,
    },
    {
      category: "Office Supplies",
      amount: 850,
      description: "Printer cartridges and stationery",
      date: new Date("2026-02-20"),
      status: "PENDING" as const,
    },
    {
      category: "Meals & Entertainment",
      amount: 3200,
      description: "Client dinner — new project kickoff",
      date: new Date("2026-03-05"),
      status: "PENDING" as const,
    },
    {
      category: "Hardware",
      amount: 12000,
      description: "External SSD for design team",
      date: new Date("2026-01-25"),
      status: "REJECTED" as const,
    },
  ];

  for (const exp of demoExpenses) {
    const existing = await prisma.expense.findFirst({
      where: { description: exp.description },
    });

    if (existing) {
      skipped.push(exp.description ?? exp.category);
      continue;
    }

    await prisma.expense.create({
      data: {
        staffId: staff?.id ?? null,
        category: exp.category,
        amount: exp.amount,
        description: exp.description,
        date: exp.date,
        status: exp.status,
      },
    });

    created.push(exp.description ?? exp.category);
  }

  return NextResponse.json({
    message: "Finance seed complete",
    created,
    skipped,
  });
}
