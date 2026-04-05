import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/vault-auth";
import { getDocumentById } from "@/modules/vault/services/document.service";

type Ctx = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// GET /api/hr-documents/:id
// ---------------------------------------------------------------------------

export const GET = withAuth(async (req: NextRequest, user, ctx?: Ctx) => {
  const { id } = await ctx!.params;
  const doc = await getDocumentById(id, user);
  return NextResponse.json({ success: true, data: doc });
});
