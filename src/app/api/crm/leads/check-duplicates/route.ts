import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { checkDuplicates } from "@/modules/crm/services/duplicate.service";
import { duplicateCheckSchema } from "@/modules/crm/schemas/lead.schema";
import { serializePrisma } from "@/lib/serialize";

/**
 * POST /api/crm/leads/check-duplicates
 *
 * Real-time duplicate check — does NOT create a lead.
 * Call this on form-blur (email / phone fields) for instant feedback.
 *
 * Body: DuplicateCheckBody
 * Response:
 *   200  { hasDuplicates: boolean, matches: DuplicateMatch[] }
 *   400  validation error
 */
export async function POST(req: NextRequest) {
  try {
    const body   = await req.json();
    const parsed = duplicateCheckSchema.parse(body);
    const result = await checkDuplicates(parsed);
    return NextResponse.json(serializePrisma(result));
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    console.error("[check-duplicates]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
