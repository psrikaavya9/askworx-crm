import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRefreshCookie, verifyRefreshToken, REFRESH_COOKIE } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

// ---------------------------------------------------------------------------
// Shared cookie-clearing helper
//
// Sets a past-expiry Set-Cookie header directly on the NextResponse so the
// browser deletes the cookie regardless of which handler ran.
// Using response.cookies.delete() (not cookies() from next/headers) ensures
// the header is always present on THIS response object.
// ---------------------------------------------------------------------------

function clearCookieOnResponse(res: NextResponse): void {
  res.cookies.set(REFRESH_COOKIE, "", {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    path:     "/",
    maxAge:   0,            // instructs browser to delete immediately
    expires:  new Date(0),  // belt-and-suspenders: past-epoch date
  });
}

// ---------------------------------------------------------------------------
// POST /api/auth/logout
//
// Revokes both the RefreshToken AND the Session in DB, then clears the
// httpOnly cookie.  Always returns 200 — even if token was already gone.
// ---------------------------------------------------------------------------

export async function POST() {
  const rawToken = await getRefreshCookie();

  const res = NextResponse.json({ success: true, message: "Logged out" });

  if (rawToken) {
    try {
      const payload = await verifyRefreshToken(rawToken);

      // Revoke RefreshToken and Session in a single transaction so there is
      // no window between the two where a valid session is paired with a
      // revoked refresh token (or vice versa).
      await prisma.$transaction([
        prisma.refreshToken.updateMany({
          where: { jti: payload.jti, revokedAt: null },
          data:  { revokedAt: new Date() },
        }),
        prisma.session.updateMany({
          where: { jti: payload.jti, revokedAt: null },
          data:  { revokedAt: new Date() },
        }),
      ]);

      logAudit(payload.sub, "LOGOUT", "auth", payload.sub);
      console.info(`[auth/logout] Revoked session jti=${payload.jti} for staffId=${payload.sub}`);
    } catch (err) {
      // Token invalid/expired — still clear the cookie below.
      // Don't surface internals; just log server-side.
      console.warn("[auth/logout] Could not revoke token:", err instanceof Error ? err.message : err);
    }
  }

  // Always clear the cookie on the response — runs whether or not the DB
  // revocation succeeded, and whether or not there was a token at all.
  clearCookieOnResponse(res);

  return res;
}

// ---------------------------------------------------------------------------
// GET /api/auth/logout
//
// Used by DashboardLayout when it detects a revoked/invalid session.
// Server Components can't modify cookies directly, so they redirect here first
// — this clears the cookie before the browser lands on /login.
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/login", req.url));
  clearCookieOnResponse(res);
  console.info("[auth/logout] GET — clearing cookie and redirecting to /login");
  return res;
}
