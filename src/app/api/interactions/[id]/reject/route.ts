import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { withAuth } from "@/lib/middleware/authMiddleware";
import type { RouteCtx } from "@/lib/middleware/authMiddleware";
import * as svc from "@/modules/customer360/services/interaction.service";

// ---------------------------------------------------------------------------
// PATCH /api/interactions/:id/reject
// Body: { reason: string, note?: string }
//   reason — mandatory dropdown category (Wrong Data | Incomplete | Policy Violation | Other)
//   note   — optional free-text explanation (max 500 chars)
// ---------------------------------------------------------------------------

const VALID_REASONS = ["Wrong Data", "Incomplete", "Policy Violation", "Other"] as const;

const schema = z.object({
  reason: z.enum(VALID_REASONS),
  note:   z.string().max(500).optional(),
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
      { success: false, error: "reason must be one of: Wrong Data, Incomplete, Policy Violation, Other" },
      { status: 400 },
    );
  }

  const { reason, note } = parsed.data;
  const ownerNote = note ? `${reason}: ${note}` : reason;

  const reviewer = {
    reviewedBy: user.sub,
    reviewedAt: new Date(),
  };

  let updated;
  try {
    updated = await svc.rejectInteraction(
      id,
      { ownerNote },
      reviewer,
      reason,
    );
  } catch (err) {
    const msg = (err as Error).message;
    const status = msg.includes("not found") ? 404 : 422;
    return NextResponse.json({ success: false, error: msg }, { status });
  }

  console.log(`[reject] interaction=${id} by=${user.sub} reason=${reason}`);
  revalidateTag(`c360-${updated.clientId}`, "default");

  return NextResponse.json({ success: true, data: updated });
});
