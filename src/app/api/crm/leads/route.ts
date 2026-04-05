import { NextRequest, NextResponse } from "next/server";
import * as leadService from "@/modules/crm/services/lead.service";
import { createLeadSchema, leadFiltersSchema } from "@/modules/crm/schemas/lead.schema";
import { DuplicateLeadError } from "@/modules/crm/services/duplicate.service";
import { ZodError } from "zod";
import { serializePrisma } from "@/lib/serialize";

export async function GET(req: NextRequest) {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const filters = leadFiltersSchema.parse(params);
    const result = await leadService.getLeads(filters);
    return NextResponse.json(serializePrisma(result));
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/crm/leads
 *
 * Body:
 *   ...createLeadSchema fields
 *   force?:       boolean   — bypass duplicate guard (default false)
 *   duplicateIds?: string[] — IDs of the known duplicates (logged for audit when force=true)
 *
 * Responses:
 *   201  — lead created successfully
 *   400  — validation error
 *   409  — duplicate detected:
 *            { duplicate: true, matches: DuplicateMatch[] }
 *          caller can re-POST with force=true to override
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Extract meta-params before schema validation
    const force        = body.force        === true;
    const duplicateIds = Array.isArray(body.duplicateIds) ? body.duplicateIds as string[] : [];

    // Validate lead data (strip unknown keys)
    const data = createLeadSchema.parse(body);

    const lead = await leadService.createLead(data, { force, duplicateIds });
    return NextResponse.json(serializePrisma(lead), { status: 201 });
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ error: err.flatten() }, { status: 400 });

    if (err instanceof DuplicateLeadError) {
      return NextResponse.json(
        {
          duplicate: true,
          message:   err.message,
          matches:   serializePrisma(err.matches),
        },
        { status: 409 },
      );
    }

    if (err instanceof Error)
      return NextResponse.json({ error: err.message }, { status: 409 });

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
