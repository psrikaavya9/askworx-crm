import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/vault-auth";
import * as repo from "@/modules/customer360/repositories/interaction.repository";

// ---------------------------------------------------------------------------
// GET /api/app-notifications
// Returns interaction-review notifications for the current user.
// ---------------------------------------------------------------------------

export const GET = withAuth(async (req: NextRequest, user) => {
  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unread") === "true";
  const limit      = Math.min(50, parseInt(searchParams.get("limit") ?? "30", 10));

  const data = await repo.findAppNotifications(user.sub, { unreadOnly, limit });

  return NextResponse.json({ success: true, data });
});
