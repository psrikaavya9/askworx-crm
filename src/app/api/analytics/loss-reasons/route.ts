import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const COLORS = ["#ef4444", "#f97316", "#eab308", "#6366f1", "#a855f7", "#14b8a6", "#3b82f6", "#94a3b8"];

export async function GET() {
  const lostLeads = await prisma.lead.findMany({
    where: { stage: "LOST" },
    select: { lostReason: true },
  });

  const counts: Record<string, number> = {};
  for (const { lostReason } of lostLeads) {
    const key = lostReason?.trim() || "No reason given";
    counts[key] = (counts[key] ?? 0) + 1;
  }

  const data = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] }));

  return NextResponse.json(data);
}
