import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/vault-auth";
import * as repo from "@/modules/customer360/repositories/interaction.repository";

// ---------------------------------------------------------------------------
// GET /api/app-notifications/count
// Returns unread count for the current user.
// ---------------------------------------------------------------------------

export const GET = withAuth(async (_req: NextRequest, user) => {
  const count = await repo.countUnreadAppNotifications(user.sub);
  return NextResponse.json({ success: true, data: { unreadCount: count } });
});
