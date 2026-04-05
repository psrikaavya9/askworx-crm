import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/vault-auth";
import { upsertWatchProgress } from "@/modules/vault/services/video.service";

// ---------------------------------------------------------------------------
// POST /api/hr-videos/progress
// Body: { videoId, watchedSeconds, totalSeconds, lastPosition, sessionData? }
// ---------------------------------------------------------------------------

export const POST = withAuth(async (req: NextRequest, user) => {
  const body = await req.json() as {
    videoId:        string;
    watchedSeconds: number;
    totalSeconds:   number;
    lastPosition:   number;
    sessionData?:   Record<string, unknown>;
  };

  if (!body.videoId) {
    return NextResponse.json({ success: false, error: "videoId is required" }, { status: 400 });
  }

  const log = await upsertWatchProgress({
    videoId:        body.videoId,
    staffId:        user.sub,
    watchedSeconds: body.watchedSeconds ?? 0,
    totalSeconds:   body.totalSeconds   ?? 0,
    lastPosition:   body.lastPosition   ?? 0,
    sessionData:    body.sessionData,
  });

  return NextResponse.json({ success: true, data: log });
});
