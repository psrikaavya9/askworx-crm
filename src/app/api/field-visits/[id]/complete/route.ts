import { NextRequest, NextResponse } from "next/server";
import * as svc from "@/modules/staff/services/fieldvisit.service";
import { withRole } from "@/lib/middleware/roleCheck";

type Ctx = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// PATCH /api/field-visits/:id/complete  (minimum role: STAFF)
//
// staffId is derived from the JWT — the service enforces visit.staffId === staffId
// so a staff member can only complete their own visits.
// ---------------------------------------------------------------------------

export const PATCH = withRole("STAFF", async (_req: NextRequest, user, ctx?: Ctx) => {
  const { id } = await ctx!.params;
  try {
    const visit = await svc.completeFieldVisit(id, user.sub);
    return NextResponse.json(visit);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 422 });
  }
});
