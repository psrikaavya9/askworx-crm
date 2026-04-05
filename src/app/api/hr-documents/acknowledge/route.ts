import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/vault-auth";
import { acknowledgeDocument } from "@/modules/vault/services/document.service";

// ---------------------------------------------------------------------------
// POST /api/hr-documents/acknowledge
// Body: { documentId, signature?, notes? }
// ---------------------------------------------------------------------------

export const POST = withAuth(async (req: NextRequest, user) => {
  const body = await req.json() as {
    documentId: string;
    signature?: string;
    notes?:     string;
  };

  if (!body.documentId) {
    return NextResponse.json({ success: false, error: "documentId is required" }, { status: 400 });
  }

  const ack = await acknowledgeDocument({
    documentId: body.documentId,
    staffId:    user.sub,
    ipAddress:  req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? undefined,
    userAgent:  req.headers.get("user-agent") ?? undefined,
    signature:  body.signature,
    notes:      body.notes,
  });

  return NextResponse.json({ success: true, data: ack }, { status: 201 });
});
