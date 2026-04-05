import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/authMiddleware";
import { roleCheck } from "@/lib/middleware/roleCheck";
import { requestEditSchema } from "@/modules/customer360/schemas/interaction.schema";
import * as svc from "@/modules/customer360/services/interaction.service";

type Ctx = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// PATCH /api/interactions/:id/request-edit
//
// Sends an interaction back to the staff member for revision.
// The owner must supply edit instructions (ownerNote — required).
// State after: approved=false, rejected=false, ownerNote=<instructions>
//
// Restricted to OWNER only.
// Guard: approved interactions are immutable.
// ---------------------------------------------------------------------------

export const PATCH = withAuth(
  roleCheck(["OWNER"])(async (req: NextRequest, _user, ctx?: Ctx) => {
    const { id } = await ctx!.params;

    const body   = await req.json().catch(() => ({}));
    const parsed = requestEditSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten() },
        { status: 400 },
      );
    }

    try {
      const interaction = await svc.requestEditInteraction(id, parsed.data);
      return NextResponse.json({ success: true, data: interaction });
    } catch (err) {
      return NextResponse.json(
        { success: false, error: (err as Error).message },
        { status: 422 },
      );
    }
  }),
);
