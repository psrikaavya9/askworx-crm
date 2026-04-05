import { NextResponse } from "next/server";
import { withAuth } from "@/lib/vault-auth";
import { getUnreadCount } from "@/modules/vault/services/notification.service";

// ---------------------------------------------------------------------------
// GET /api/hr-notifications/count
// ---------------------------------------------------------------------------

export const GET = withAuth(async (_req, user) => {
  const unreadCount = await getUnreadCount(user.sub);
  return NextResponse.json({ success: true, data: { unreadCount } });
});
