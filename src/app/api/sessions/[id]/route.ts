import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/middleware/authMiddleware";
import { AccessTokenPayload } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// DELETE /api/sessions/[id]
//
// Revokes (kills) a specific session — "remote logout" from another device.
// Users can only revoke their own sessions.
//
// Rules:
//   - 404 if session doesn't exist
//   - 403 if session belongs to a different user
//   - 409 if session is already revoked
//   - 400 if user tries to revoke their current session
//     (use POST /api/auth/logout for that — it also clears the cookie)
//
// On success:
//   - Sets revokedAt on the Session record
//   - Also revokes the linked RefreshToken so the rotated cookie can't be
//     exchanged for a new access token either
// ---------------------------------------------------------------------------

export const DELETE = withAuth(async (_req: NextRequest, user: AccessTokenPayload, ctx?: Ctx) => {
  const { id } = await ctx!.params;

  const session = await prisma.session.findUnique({
    where:  { id },
    select: { id: true, jti: true, staffId: true, revokedAt: true },
  });

  // ── Not found ──────────────────────────────────────────────────────────────
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Session not found" },
      { status: 404 }
    );
  }

  // ── Wrong owner ────────────────────────────────────────────────────────────
  if (session.staffId !== user.sub) {
    return NextResponse.json(
      { success: false, error: "You can only revoke your own sessions", code: "FORBIDDEN" },
      { status: 403 }
    );
  }

  // ── Already revoked ────────────────────────────────────────────────────────
  if (session.revokedAt) {
    return NextResponse.json(
      { success: false, error: "Session is already inactive" },
      { status: 409 }
    );
  }

  // ── Guard: can't remote-kill the current session via this endpoint ─────────
  // This prevents the user from accidentally locking themselves out.
  // Use POST /api/auth/logout to end the current session (it clears the cookie).
  if (session.jti === user.jti) {
    return NextResponse.json(
      {
        success: false,
        error:   "Cannot revoke your current session here. Use POST /api/auth/logout instead.",
        code:    "REVOKE_CURRENT_SESSION",
      },
      { status: 400 }
    );
  }

  // ── Revoke session + its linked refresh token atomically ───────────────────
  await prisma.$transaction([
    prisma.session.update({
      where: { id },
      data:  { revokedAt: new Date() },
    }),
    // Revoke the refresh token so the evicted device can't silently refresh
    prisma.refreshToken.updateMany({
      where: { jti: session.jti, revokedAt: null },
      data:  { revokedAt: new Date() },
    }),
  ]);

  return NextResponse.json({
    success: true,
    message: "Session revoked. The device will be signed out on its next request.",
  });
});
