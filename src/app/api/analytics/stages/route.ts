import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const STAGE_LABELS: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  PROPOSAL: "Proposal",
  WON: "Won",
  LOST: "Lost",
};

const STAGE_COLORS: Record<string, string> = {
  NEW: "#94a3b8",
  CONTACTED: "#3b82f6",
  QUALIFIED: "#6366f1",
  PROPOSAL: "#a855f7",
  WON: "#22c55e",
  LOST: "#ef4444",
};

const STAGE_ORDER = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"];

export async function GET() {
  const groups = await prisma.lead.groupBy({
    by: ["stage"],
    _count: { _all: true },
  });

  const data = STAGE_ORDER.map((stage) => {
    const found = groups.find((g) => g.stage === stage);
    return {
      name: STAGE_LABELS[stage] ?? stage,
      value: found?._count._all ?? 0,
      color: STAGE_COLORS[stage] ?? "#94a3b8",
    };
  }).filter((d) => d.value > 0);

  return NextResponse.json(data);
}
