import { NextRequest, NextResponse } from "next/server";
import * as leadService from "@/modules/crm/services/lead.service";
import { autoDistributeSchema } from "@/modules/crm/schemas/lead.schema";
import { ZodError } from "zod";

/**
 * POST /api/crm/leads/auto-distribute
 *
 * Distributes leads equally (round-robin) across active sales reps.
 *
 * Body:
 *   lead_ids?:   string[]  — specific leads to distribute (omit = all unassigned)
 *   staff_ids?:  string[]  — specific reps to use (omit = all ACTIVE staff)
 *   performedBy?: string
 *
 * Response 200:
 *   { updated: number, distribution: Record<staffId, count> }
 */
export async function POST(req: NextRequest) {
  try {
    const body  = await req.json();
    const input = autoDistributeSchema.parse(body);
    const result = await leadService.autoDistribute(input);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    if (err instanceof Error)
      return NextResponse.json({ error: err.message }, { status: 422 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
