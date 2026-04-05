import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/middleware/roleCheck";
import { unlockAccount } from "@/lib/mfa";
import { AccessTokenPayload } from "@/lib/auth";

// ---------------------------------------------------------------------------
// POST /api/auth/unlock-account  — OWNER only
//
// Body: { staffId: string }
// ---------------------------------------------------------------------------

export const POST = withRole("OWNER", async (req: NextRequest, user: AccessTokenPayload) => {
  const body = await req.json() as { staffId?: string };
  const { staffId } = body;

  if (!staffId) {
    return Response.json(
      { success: false, error: "staffId is required" },
      { status: 400 }
    ) as never;
  }

  await unlockAccount(staffId, user.sub);

  return Response.json({ success: true, message: "Account unlocked" }) as never;
});
