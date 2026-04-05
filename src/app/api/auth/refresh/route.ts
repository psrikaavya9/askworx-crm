import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getRefreshCookie,
  verifyRefreshToken,
  generateAccessToken,
  generateRefreshToken,
  setRefreshCookie,
  clearRefreshCookie,
  REFRESH_TTL,
} from "@/lib/auth";
import { rotateSessionJti } from "@/lib/session";
import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// POST /api/auth/refresh
//
// How it works:
//   1. Reads refresh_token from the httpOnly cookie (never from request body
//      or Authorization header — the raw token is never exposed to JS)
//   2. Verifies the JWT signature using JWT_SECRET (same key as login)
//   3. Looks up the token's jti in the DB — catches revoked / replayed tokens
//   4. Rotates: revokes old refresh token, issues a brand-new one
//   5. Sets the new refresh token in the httpOnly cookie
//   6. Returns the new access token (and user) in the JSON body
//
// The refresh token itself is NEVER included in the JSON response.
//
// Responses:
//   200 → { success: true,  accessToken, user: { id, name, role, ... } }
//   401 → { success: false, error, code }   ← missing / invalid / expired
//   403 → { success: false, error, code }   ← account locked / inactive
//   500 → { success: false, error: "Internal server error" }
// ---------------------------------------------------------------------------

export async function POST() {
  try {
    // ── 1. Read refresh token from httpOnly cookie ─────────────────────────
    const rawToken = await getRefreshCookie();

    if (!rawToken) {
      return NextResponse.json(
        { success: false, error: "No refresh token found", code: "NO_REFRESH_TOKEN" },
        { status: 401 }
      );
    }

    // ── 2. Verify JWT signature + expiry (uses JWT_SECRET via Web Crypto) ──
    let payload: Awaited<ReturnType<typeof verifyRefreshToken>>;
    try {
      payload = await verifyRefreshToken(rawToken);
    } catch {
      // Signature invalid or token expired — clear the cookie and reject
      await clearRefreshCookie();
      return NextResponse.json(
        { success: false, error: "Refresh token is invalid or expired", code: "REFRESH_INVALID" },
        { status: 401 }
      );
    }

    // ── 3. Check DB — must exist, not revoked, not past expiry ─────────────
    //    This catches replay attacks: if a stolen token was already rotated,
    //    its jti is revoked in DB even though the JWT itself is still valid.
    const stored = await prisma.refreshToken.findUnique({
      where:   { jti: payload.jti },
      include: { staff: true },
    });

    if (!stored) {
      await clearRefreshCookie();
      return NextResponse.json(
        { success: false, error: "Refresh token not recognised", code: "REFRESH_NOT_FOUND" },
        { status: 401 }
      );
    }

    if (stored.revokedAt) {
      // Token was already rotated — possible replay attack; clear cookie
      await clearRefreshCookie();
      return NextResponse.json(
        { success: false, error: "Refresh token has already been used", code: "REFRESH_REPLAYED" },
        { status: 401 }
      );
    }

    if (stored.expiresAt < new Date()) {
      // Expired in DB (belt-and-suspenders; JWT expiry check above usually catches this)
      await clearRefreshCookie();
      return NextResponse.json(
        { success: false, error: "Refresh token has expired", code: "REFRESH_EXPIRED" },
        { status: 401 }
      );
    }

    const { staff } = stored;

    // ── 4. Guard: account must still be active and unlocked ────────────────
    if (staff.status !== "ACTIVE" || staff.isLocked) {
      // Revoke the token so further refresh attempts also fail immediately
      await prisma.refreshToken.update({
        where: { jti: payload.jti },
        data:  { revokedAt: new Date() },
      });
      await clearRefreshCookie();
      return NextResponse.json(
        { success: false, error: "Account is unavailable", code: "ACCOUNT_INACTIVE" },
        { status: 403 }
      );
    }

    // ── 5. Rotate — generate fresh tokens with a new jti ───────────────────
    //    Old refresh token is revoked atomically in the same DB transaction,
    //    so there is no window where two valid refresh tokens coexist.
    const newJti    = randomUUID();
    const expiresAt = new Date(Date.now() + REFRESH_TTL * 1000);

    const [accessToken, newRefreshToken] = await Promise.all([
      generateAccessToken({
        id:        staff.id,
        jti:       newJti,      // access token carries session jti
        email:     staff.email,
        role:      staff.role,
        firstName: staff.firstName,
        lastName:  staff.lastName,
      }),
      generateRefreshToken(staff.id, newJti),
    ]);

    // Revoke old + persist new in one atomic transaction
    await prisma.$transaction([
      prisma.refreshToken.update({
        where: { jti: payload.jti },
        data:  { revokedAt: new Date() },
      }),
      prisma.refreshToken.create({
        data: { jti: newJti, staffId: staff.id, expiresAt },
      }),
    ]);

    // Keep the Session record's jti in sync with the new refresh token
    await rotateSessionJti(payload.jti, newJti);

    // ── 6. Set new refresh token in httpOnly cookie ─────────────────────────
    //    The raw refresh token string never appears in the JSON body.
    await setRefreshCookie(newRefreshToken);

    // ── 7. Return new access token (flat shape, matches /api/auth/login) ───
    return NextResponse.json({
      success:     true,
      accessToken,
      user: {
        id:         staff.id,
        name:       `${staff.firstName} ${staff.lastName}`.trim(),
        role:       staff.role,
        // extras used by AuthContext
        email:      staff.email,
        firstName:  staff.firstName,
        lastName:   staff.lastName,
        department: staff.department,
      },
    });
  } catch (err) {
    console.error("[auth/refresh] Unhandled error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
