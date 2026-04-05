import { NextResponse } from "next/server";
import { withAuth } from "@/lib/vault-auth";
import { getDocumentAlerts } from "@/modules/vault/services/expiry.service";

// ---------------------------------------------------------------------------
// GET /api/hr-documents/alerts
// Returns expiring-soon, critical, and expired document summaries
// ---------------------------------------------------------------------------

export const GET = withAuth(async () => {
  const alerts = await getDocumentAlerts();
  return NextResponse.json({ success: true, data: alerts });
}, "MANAGER");
