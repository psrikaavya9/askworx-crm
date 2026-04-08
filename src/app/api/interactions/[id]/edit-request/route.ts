import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { withAuth } from "@/lib/middleware/authMiddleware";
import type { RouteCtx } from "@/lib/middleware/authMiddleware";
import * as svc from "@/modules/customer360/services/interaction.service";

// ---------------------------------------------------------------------------
// PATCH /api/interactions/:id/edit-request
// Body: { message: string }
// State after: reviewStatus=EDIT_REQUESTED, approved=false, rejected=false
// ---------------------------------------------------------------------------

const schema = z.object({
  message: z.string().min(1, "message is required").max(500),
});

export const PATCH = withAuth(async (
  req: NextRequest,
  user,
  ctx?: RouteCtx,
) => {
  const { id } = await ctx!.params as { id: string };

  const body   = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "message is required (max 500 chars)" },
      { status: 400 },
    );
  }

  const reviewer = {
    reviewedBy: user.sub,
    reviewedAt: new Date(),
  };

  let updated;
  try {
    updated = await svc.requestEditInteraction(
      id,
      { ownerNote: parsed.data.message },
      reviewer,
    );
  } catch (err) {
    const msg = (err as Error).message;
    const status = msg.includes("not found") ? 404 : 422;
    return NextResponse.json({ success: false, error: msg }, { status });
  }

  console.log(`[edit-request] interaction=${id} by=${user.sub} → sent back for edit`);
  revalidateTag(`c360-${updated.clientId}`, "default");

  return NextResponse.json({ success: true, data: updated });
});
