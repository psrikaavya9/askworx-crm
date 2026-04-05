import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/vault-auth";
import { listNotificationsForUser } from "@/modules/vault/services/notification.service";

// ---------------------------------------------------------------------------
// GET /api/hr-notifications
// Query params: unread (boolean), page, limit
// ---------------------------------------------------------------------------

export const GET = withAuth(async (req: NextRequest, user) => {
  const { searchParams } = new URL(req.url);

  const result = await listNotificationsForUser(user.sub, {
    unreadOnly: searchParams.get("unread") === "true",
    page:       searchParams.get("page")  ? parseInt(searchParams.get("page")!,  10) : undefined,
    limit:      searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : undefined,
  });

  const page  = parseInt(searchParams.get("page")  ?? "1",  10);
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);

  return NextResponse.json({
    success: true,
    data:    result.rows,
    meta: {
      total:      result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    },
  });
});
