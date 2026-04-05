import { NextRequest, NextResponse } from "next/server";
import { fieldVisitFiltersSchema, createFieldVisitSchema } from "@/modules/staff/schemas/fieldvisit.schema";
import * as svc from "@/modules/staff/services/fieldvisit.service";
import { withAuth } from "@/lib/middleware/authMiddleware";
import { withRole } from "@/lib/middleware/roleCheck";

// ---------------------------------------------------------------------------
// GET /api/field-visits  (any authenticated user)
// ---------------------------------------------------------------------------

export const GET = withAuth(async (req: NextRequest) => {
  const raw = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = fieldVisitFiltersSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const result = await svc.listFieldVisits(parsed.data);
  return NextResponse.json(result);
});

// ---------------------------------------------------------------------------
// POST /api/field-visits  (minimum role: STAFF)
//
// staffId is derived from the JWT — never trusted from the request body.
// ---------------------------------------------------------------------------

export const POST = withRole("STAFF", async (req: NextRequest, user) => {
  const body = await req.json();
  // Strip any staffId the caller sent — always use the verified JWT subject
  const parsed = createFieldVisitSchema.safeParse({ ...body, staffId: user.sub });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const visit = await svc.createFieldVisit(parsed.data);
    return NextResponse.json(visit, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 422 });
  }
});
