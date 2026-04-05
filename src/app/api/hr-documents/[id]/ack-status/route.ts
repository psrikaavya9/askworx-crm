import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/vault-auth";
import { getAckStatus } from "@/modules/vault/services/document.service";

type Ctx = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// GET /api/hr-documents/:id/ack-status
// ---------------------------------------------------------------------------

export const GET = withAuth(async (req: NextRequest, _user, ctx?: Ctx) => {
  const { id } = await ctx!.params;
  const result = await getAckStatus(id);
  return NextResponse.json({ success: true, data: result });
});
