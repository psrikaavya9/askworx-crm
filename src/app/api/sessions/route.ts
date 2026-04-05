import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/middleware/authMiddleware";
import { AccessTokenPayload } from "@/lib/auth";

// ---------------------------------------------------------------------------
// GET /api/sessions
//
// Returns all active sessions for the authenticated user.
// The session the request is coming from is marked with isCurrent: true.
//
// Response shape:
// {
//   success: true,
//   data: [
//     {
//       id:           string
//       browser:      string        // "Chrome"
//       deviceName:   string        // "Windows"
//       deviceLabel:  string        // "Chrome on Windows"
//       ipAddress:    string | null
//       isActive:     true          // always true (only active sessions returned)
//       isCurrent:    boolean       // true for the session making this request
//       createdAt:    string        // ISO 8601
//       lastActiveAt: string        // ISO 8601
//     }
//   ]
// }
// ---------------------------------------------------------------------------

export const GET = withAuth(async (_req: NextRequest, user: AccessTokenPayload) => {
  const sessions = await prisma.session.findMany({
    where:   { staffId: user.sub, revokedAt: null },
    orderBy: { lastActiveAt: "desc" },
    select: {
      id:          true,
      jti:         true,   // used to detect current session — never sent to client
      ipAddress:   true,
      browser:     true,
      deviceName:  true,
      deviceLabel: true,
      lastActiveAt: true,
      createdAt:   true,
    },
  });

  const data = sessions.map(({ jti, ...s }) => ({
    ...s,
    browser:     s.browser     ?? "Unknown Browser",
    deviceName:  s.deviceName  ?? "Unknown Device",
    deviceLabel: s.deviceLabel ?? `${s.browser ?? "Browser"} on ${s.deviceName ?? "Device"}`,
    isActive:    true,       // guaranteed — query filters revokedAt: null
    isCurrent:   jti === user.jti,
  }));

  return NextResponse.json({ success: true, data });
});
