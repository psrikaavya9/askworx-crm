import { NextRequest, NextResponse } from "next/server";
import * as svc from "@/modules/crm/services/pipeline-template.service";
import { serializePrisma } from "@/lib/serialize";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/crm/pipeline/templates/:id/kanban
 *
 * Returns the Kanban view for a template with leads grouped by stage.
 * Single DB round-trip — safe for real-time use.
 *
 * Response shape:
 * {
 *   template: { id, name, dealType, ... },
 *   columns: [
 *     {
 *       stage: { id, name, color, probability, order, isWon, isLost },
 *       leads: [{ id, firstName, lastName, dealValue, score, ... }],
 *       totalValue: number,
 *       weightedValue: number,   // totalValue * probability/100 — for forecasting
 *       count: number
 *     }
 *   ],
 *   totalPipelineValue: number,
 *   forecastedValue: number
 * }
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const kanban = await svc.getKanban(id);
    return NextResponse.json(serializePrisma(kanban));
  } catch (err) {
    if (err instanceof Error && err.message.includes("not found"))
      return NextResponse.json({ error: err.message }, { status: 404 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
