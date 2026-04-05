import { NextRequest, NextResponse } from "next/server";
import * as leadService from "@/modules/crm/services/lead.service";
import { bulkDeleteSchema } from "@/modules/crm/schemas/lead.schema";
import { ZodError } from "zod";

/**
 * DELETE /api/crm/leads/bulk-delete
 *
 * Body:
 *   lead_ids: string[]
 *
 * Response 200:
 *   { deleted: number }
 */
export async function DELETE(req: NextRequest) {
  try {
    const body    = await req.json();
    const input   = bulkDeleteSchema.parse(body);
    const deleted = await leadService.bulkDelete(input);
    return NextResponse.json({ deleted });
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    if (err instanceof Error)
      return NextResponse.json({ error: err.message }, { status: 422 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
