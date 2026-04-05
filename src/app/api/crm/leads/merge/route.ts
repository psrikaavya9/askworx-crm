import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import * as leadService from "@/modules/crm/services/lead.service";
import { mergeLeadsSchema } from "@/modules/crm/schemas/lead.schema";
import { serializePrisma } from "@/lib/serialize";

/**
 * POST /api/crm/leads/merge
 *
 * Merges two leads: the source is absorbed into the target and then deleted.
 *
 * What is moved from source → target:
 *   • All LeadNotes
 *   • All LeadActivity records
 *   • All FollowUpReminders
 *   • Null fields on the target are filled from the source
 *   • Tags are union-merged
 *
 * A LEAD_MERGED audit activity is written on the target.
 * The source lead is permanently deleted.
 *
 * Body: { targetId: string, sourceId: string, performedBy?: string }
 * Response:
 *   200  — merged lead (full includes)
 *   400  — validation error
 *   404  — either lead not found
 *   409  — targetId === sourceId
 */
export async function POST(req: NextRequest) {
  try {
    const body  = await req.json();
    const input = mergeLeadsSchema.parse(body);
    const lead  = await leadService.mergeLeads(input);
    return NextResponse.json(serializePrisma(lead));
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ error: err.flatten() }, { status: 400 });

    if (err instanceof Error) {
      const status =
        err.message.includes("not found")  ? 404 :
        err.message.includes("different")  ? 409 : 500;
      return NextResponse.json({ error: err.message }, { status });
    }

    console.error("[leads/merge]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
