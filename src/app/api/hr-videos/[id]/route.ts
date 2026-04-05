import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/vault-auth";
import { getVideoById } from "@/modules/vault/services/video.service";

type Ctx = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// GET /api/hr-videos/:id
// ---------------------------------------------------------------------------

export const GET = withAuth(async (req: NextRequest, user, ctx?: Ctx) => {
  const { id } = await ctx!.params;
  const video = await getVideoById(id, user);
  return NextResponse.json({ success: true, data: video });
});
