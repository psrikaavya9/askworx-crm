import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as svc from "@/modules/staff/services/fieldvisit.service";
import { withRole } from "@/lib/middleware/roleCheck";

const approveBodySchema = z.object({
  action:     z.enum(["approve", "reject"]),
  reviewNote: z.string().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// PATCH /api/field-visits/:id/approve  (minimum role: MANAGER)
//
// reviewerId is derived from the JWT — never trusted from the request body.
// ---------------------------------------------------------------------------

export const PATCH = withRole("MANAGER", async (req: NextRequest, user, ctx?: Ctx) => {
  const { id } = await ctx!.params;
  const body = await req.json();
  const parsed = approveBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const visit = await svc.reviewFieldVisit(id, {
      action:     parsed.data.action,
      reviewerId: user.sub,               // always from JWT
      reviewNote: parsed.data.reviewNote,
    });
    return NextResponse.json(visit);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 422 });
  }
});
