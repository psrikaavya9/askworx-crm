import { NextRequest, NextResponse } from "next/server";
import { computeAndSave } from "@/modules/crm/services/scoring.service";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/crm/leads/:id/score
 * Recalculates and persists the lead score. Returns the breakdown.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const breakdown = await computeAndSave(id);
    return NextResponse.json(breakdown, { status: 200 });
  } catch (err) {
    if (err instanceof Error && err.message.includes("not found"))
      return NextResponse.json({ error: err.message }, { status: 404 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * GET /api/crm/leads/:id/score
 * Returns the stored score (without recalculating).
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const { prisma } = await import("@/lib/prisma");
    const score = await prisma.leadScore.findUnique({ where: { leadId: id } });
    if (!score) return NextResponse.json({ error: "Score not calculated yet" }, { status: 404 });
    return NextResponse.json(score);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
