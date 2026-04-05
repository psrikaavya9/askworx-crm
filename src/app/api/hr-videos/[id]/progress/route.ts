import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/vault-auth";
import { getWatchProgress, getAllWatchLogs } from "@/modules/vault/services/video.service";

type Ctx = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// GET /api/hr-videos/:id/progress
// Managers get all staff logs; staff get their own
// ---------------------------------------------------------------------------

export const GET = withAuth(async (req: NextRequest, user, ctx?: Ctx) => {
  const { id: videoId } = await ctx!.params;

  if (user.role === "ADMIN" || user.role === "MANAGER") {
    const logs = await getAllWatchLogs(videoId);
    return NextResponse.json({ success: true, data: logs });
  }

  const log = await getWatchProgress(videoId, user.sub);
  return NextResponse.json({ success: true, data: log });
});
