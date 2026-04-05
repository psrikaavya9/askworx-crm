import { NextRequest, NextResponse } from "next/server";
import * as leadService from "@/modules/crm/services/lead.service";
import { bulkAssignSchema } from "@/modules/crm/schemas/lead.schema";
import { ZodError } from "zod";

/**
 * POST /api/crm/leads/bulk-assign
 *
 * Body:
 *   lead_ids:    string[]   — IDs of leads to assign
 *   assigned_to: string     — staff ID
 *   overwrite?:  boolean    — re-assign already-assigned leads (default false)
 *   performedBy?: string    — actor for the audit log (default "system")
 *
 * Response 200:
 *   { updated: number, skipped: number }
 */
export async function POST(req: NextRequest) {
  try {
    const body  = await req.json();
    const input = bulkAssignSchema.parse(body);
    const result = await leadService.bulkAssign(input);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    if (err instanceof Error)
      return NextResponse.json({ error: err.message }, { status: 422 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
