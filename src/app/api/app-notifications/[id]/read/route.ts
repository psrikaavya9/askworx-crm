import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/vault-auth";
import * as repo from "@/modules/customer360/repositories/interaction.repository";

// ---------------------------------------------------------------------------
// PATCH /api/app-notifications/:id/read
// ---------------------------------------------------------------------------

export const PATCH = withAuth(async (
  _req: NextRequest,
  user,
  ctx?: { params: Promise<{ id: string }> },
) => {
  const { id } = await ctx!.params;
  await repo.markAppNotificationRead(id, user.sub);
  return NextResponse.json({ success: true });
});
