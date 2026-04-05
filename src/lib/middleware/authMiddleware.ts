import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractBearerToken, verifyAccessToken, AccessTokenPayload } from "@/lib/auth";
import { validateSession, touchSession } from "@/lib/session";

// ---------------------------------------------------------------------------
// Shared types — exported so roleCheck.ts can compose without circular deps
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RouteCtx = { params: Promise<any> };

export type AuthHandler = (
  req:   NextRequest,
  user:  AccessTokenPayload,  // always carries fresh DB role — never stale JWT role
  ctx?:  RouteCtx
) => Promise<NextResponse>;

// ---------------------------------------------------------------------------
// withAuth — the single place that does all authentication work
//
// Steps (in order):
//   1. Extract Bearer token from Authorization header
//   2. Verify JWT signature + expiry (uses JWT_SECRET via Web Crypto)
//   3. Validate session is still active (inactivity timeout + revocation)
//   4. Fetch fresh role / lock / status from DB (zero-trust — ignores JWT role)
//   5. Touch session lastActiveAt (fire-and-forget)
//   6. Call the wrapped handler with the hydrated user
//
// Usage:
//   // Auth only (no role restriction)
//   export const GET = withAuth(async (req, user) => {
//     return NextResponse.json({ userId: user.sub });
//   });
//
//   // With a dynamic route param
//   export const PATCH = withAuth(async (req, user, ctx) => {
//     const { id } = await ctx!.params;
//     return NextResponse.json({ id });
//   });
//
//   // Composed with roleCheck (see roleCheck.ts)
//   export const DELETE = withAuth(roleCheck(["ADMIN", "OWNER"])(handler));
// ---------------------------------------------------------------------------

export function withAuth(handler: AuthHandler) {
  return async (req: NextRequest, ctx: RouteCtx): Promise<NextResponse> => {

    // ── Step 1: Extract Bearer token ────────────────────────────────────────
    const token = extractBearerToken(req.headers.get("authorization"));
    if (!token) {
      return NextResponse.json(
        { success: false, error: "Authentication required", code: "MISSING_TOKEN" },
        { status: 401 }
      );
    }

    // ── Step 2: Verify JWT ───────────────────────────────────────────────────
    let user: AccessTokenPayload;
    try {
      user = await verifyAccessToken(token);
    } catch (err) {
      const expired = (err as Error).message === "Token expired";
      return NextResponse.json(
        {
          success: false,
          error:   expired ? "Access token expired" : "Invalid token",
          code:    expired ? "TOKEN_EXPIRED"        : "INVALID_TOKEN",
        },
        { status: 401 }
      );
    }

    // ── Step 3: Validate session (inactivity + revocation) ───────────────────
    const session = await validateSession(user.jti);
    if (!session.valid) {
      return NextResponse.json(
        {
          success: false,
          error:   session.reason === "INACTIVE"
            ? "Session expired due to inactivity. Please log in again."
            : "Session has been revoked. Please log in again.",
          code: "SESSION_INVALID",
        },
        { status: 401 }
      );
    }

    // ── Step 4: Zero-trust DB fetch ──────────────────────────────────────────
    // Never trust the role stored in the JWT — always read it fresh from DB.
    // This means role changes and account suspensions take effect immediately
    // on the very next request, with no need to invalidate existing tokens.
    const freshStaff = await prisma.staff.findUnique({
      where:  { id: user.sub },
      select: { role: true, isLocked: true, status: true },
    });

    if (!freshStaff) {
      return NextResponse.json(
        { success: false, error: "Account not found", code: "ACCOUNT_NOT_FOUND" },
        { status: 401 }
      );
    }
    if (freshStaff.isLocked) {
      return NextResponse.json(
        { success: false, error: "Account is locked", code: "ACCOUNT_LOCKED" },
        { status: 403 }
      );
    }
    if (freshStaff.status !== "ACTIVE") {
      return NextResponse.json(
        { success: false, error: "Account is inactive", code: "ACCOUNT_INACTIVE" },
        { status: 403 }
      );
    }

    // Overwrite JWT role with the live DB value
    user = { ...user, role: freshStaff.role };

    // ── Step 5: Touch session ────────────────────────────────────────────────
    // Fire-and-forget — a failure here must never block the response
    touchSession(user.jti).catch(() => null);

    // ── Step 6: Delegate to handler ──────────────────────────────────────────
    try {
      return await handler(req, user, ctx);
    } catch (err) {
      const e       = err as { statusCode?: number; message?: string };
      const status  = e.statusCode ?? 500;
      const message = e.message    ?? "Internal server error";
      if (status >= 500) console.error("[withAuth] Unhandled error in handler:", err);
      return NextResponse.json({ success: false, error: message }, { status });
    }
  };
}
