import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { withAuth } from "@/lib/middleware/authMiddleware";
import type { RouteCtx } from "@/lib/middleware/authMiddleware";
import * as svc from "@/modules/customer360/services/interaction.service";

// ---------------------------------------------------------------------------
// PATCH /api/interactions/:id/approve
// ---------------------------------------------------------------------------

export const PATCH = withAuth(async (
  _req: NextRequest,
  user,
  ctx?: RouteCtx,
) => {
  const { id } = await ctx!.params as { id: string };

  const reviewer = {
    reviewedBy: user.sub,
    reviewedAt: new Date(),
  };

  let updated;
  try {
    updated = await svc.approveInteraction(id, { ownerNote: undefined }, reviewer);
  } catch (err) {
    const msg = (err as Error).message;
    const status = msg.includes("not found") ? 404 : 422;
    return NextResponse.json({ success: false, error: msg }, { status });
  }

  console.log(`[approve] interaction=${id} by=${user.sub} → approved`);
  revalidateTag(`c360-${updated.clientId}`, "default");

  return NextResponse.json({ success: true, data: updated });
});
