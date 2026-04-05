import { NextResponse } from "next/server";
import { withAuth } from "@/lib/vault-auth";
import { markAllNotificationsRead } from "@/modules/vault/services/notification.service";

// ---------------------------------------------------------------------------
// PATCH /api/hr-notifications/read-all
// ---------------------------------------------------------------------------

export const PATCH = withAuth(async (_req, user) => {
  const markedRead = await markAllNotificationsRead(user.sub);
  return NextResponse.json({ success: true, data: { markedRead } });
});
