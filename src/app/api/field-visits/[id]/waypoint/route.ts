import { NextRequest, NextResponse } from "next/server";
import { addWaypointSchema } from "@/modules/staff/schemas/fieldvisit.schema";
import * as svc from "@/modules/staff/services/fieldvisit.service";
import { withRole } from "@/lib/middleware/roleCheck";

type Ctx = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// POST /api/field-visits/:id/waypoint  (minimum role: STAFF)
// ---------------------------------------------------------------------------

export const POST = withRole("STAFF", async (req: NextRequest, _user, ctx?: Ctx) => {
  const { id } = await ctx!.params;
  const body = await req.json();
  const parsed = addWaypointSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const updated = await svc.addWaypoint(id, parsed.data);
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 422 });
  }
});
