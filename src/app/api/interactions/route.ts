import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/middleware/roleCheck";
import {
  createInteractionSchema,
  interactionFiltersSchema,
} from "@/modules/customer360/schemas/interaction.schema";
import * as svc from "@/modules/customer360/services/interaction.service";

// ---------------------------------------------------------------------------
// GET /api/interactions?clientId=&type=&page=&pageSize=
//
// Returns paginated interactions for the given client, sorted newest-first.
// clientId is required.  Accessible by any authenticated staff member.
// ---------------------------------------------------------------------------

export const GET = withRole("STAFF", async (req: NextRequest) => {
  const raw    = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = interactionFiltersSchema.safeParse(raw);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await svc.listInteractions(parsed.data);
  return NextResponse.json({ success: true, ...result });
});

// ---------------------------------------------------------------------------
// POST /api/interactions
//
// Creates a new interaction (CALL, VISIT, or NOTE).
// staffId is derived from the authenticated user's JWT — staff can only log
// interactions as themselves.
// ---------------------------------------------------------------------------

export const POST = withRole("STAFF", async (req: NextRequest, user) => {
  const body   = await req.json();
  const parsed = createInteractionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    // user.sub is the authenticated staff member's ID (zero-trust from withAuth)
    const interaction = await svc.createInteraction(parsed.data, user.sub);
    return NextResponse.json({ success: true, data: interaction }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 422 },
    );
  }
});
