import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/vault-auth";
import { updateDocumentStatus, DocumentStatus } from "@/modules/vault/services/document.service";

// ---------------------------------------------------------------------------
// PATCH /api/hr-documents/status
// Body: { id, status: "ACTIVE" | "ARCHIVED" | "EXPIRED" }
// ---------------------------------------------------------------------------

export const PATCH = withAuth(async (req: NextRequest) => {
  const body = await req.json() as { id: string; status: DocumentStatus };

  if (!body.id || !body.status) {
    return NextResponse.json({ success: false, error: "id and status are required" }, { status: 400 });
  }

  const valid: DocumentStatus[] = ["ACTIVE", "ARCHIVED", "EXPIRED"];
  if (!valid.includes(body.status)) {
    return NextResponse.json(
      { success: false, error: `status must be one of: ${valid.join(", ")}` },
      { status: 400 }
    );
  }

  const doc = await updateDocumentStatus(body.id, body.status);
  return NextResponse.json({ success: true, data: doc });
}, "MANAGER");
