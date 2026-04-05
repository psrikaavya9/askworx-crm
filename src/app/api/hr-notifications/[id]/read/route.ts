import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/vault-auth";
import { markNotificationRead } from "@/modules/vault/services/notification.service";

type Ctx = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// PATCH /api/hr-notifications/:id/read
// ---------------------------------------------------------------------------

export const PATCH = withAuth(async (req: NextRequest, user, ctx?: Ctx) => {
  const { id } = await ctx!.params;
  const updated = await markNotificationRead(id, user.sub);

  if (!updated) {
    return NextResponse.json(
      { success: false, error: "Notification not found or already read" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, data: { id, isRead: true } });
});
