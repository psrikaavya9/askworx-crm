import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export async function GET() {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const invoices = await prisma.invoice.findMany({
    where: { status: "PAID", createdAt: { gte: sixMonthsAgo } },
    select: { createdAt: true, totalAmount: true },
  });

  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { year: d.getFullYear(), month: d.getMonth(), label: MONTH_LABELS[d.getMonth()] };
  });

  const data = months.map(({ year, month, label }) => {
    const revenue = invoices
      .filter((inv) => {
        const d = new Date(inv.createdAt);
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
    return { month: label, revenue };
  });

  return NextResponse.json(data);
}
