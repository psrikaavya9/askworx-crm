import { NextRequest, NextResponse } from "next/server";
import * as leadService from "@/modules/crm/services/lead.service";
import { bulkMoveStageSchema } from "@/modules/crm/schemas/lead.schema";
import { ZodError } from "zod";

/**
 * POST /api/crm/leads/bulk-stage
 *
 * Body:
 *   lead_ids:    string[]
 *   stage:       PipelineStage
 *   performedBy?: string
 *
 * Response 200:
 *   { updated: number }
 */
export async function POST(req: NextRequest) {
  try {
    const body    = await req.json();
    const input   = bulkMoveStageSchema.parse(body);
    const updated = await leadService.bulkMoveStage(input);
    return NextResponse.json({ updated });
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    if (err instanceof Error)
      return NextResponse.json({ error: err.message }, { status: 422 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
