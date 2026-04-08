import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/vault-auth";
import * as repo from "@/modules/customer360/repositories/interaction.repository";

// ---------------------------------------------------------------------------
// PATCH /api/app-notifications/read-all
// ---------------------------------------------------------------------------

export const PATCH = withAuth(async (_req: NextRequest, user) => {
  const result = await repo.markAllAppNotificationsRead(user.sub);
  return NextResponse.json({ success: true, data: { markedRead: result.count } });
});
