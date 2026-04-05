import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyMfaPendingToken,
  generateAccessToken,
  generateRefreshToken,
  setRefreshCookie,
  REFRESH_TTL,
} from "@/lib/auth";
import {
  buildDeviceFingerprint,
  parseDeviceLabel,
  trustDevice,
  createSession,
  logLoginEvent,
} from "@/lib/session";
import { validateOtp } from "@/lib/mfa";
import { OtpPurpose } from "@/generated/prisma/client";
import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// POST /api/auth/verify-otp
//
// Called after /api/auth/login returns { mfaRequired: true, mfaPendingToken }.
//
// Body:
//   {
//     mfaPendingToken: string   // short-lived JWT proving password was correct
//     otp:            string   // 6-digit code from SMS/console
//     trustDevice?:   boolean  // if true, skip OTP for 30 days on this device
//   }
//
// Responses:
//   200 → { success: true, accessToken, user: { id, name, role, ... } }
//   400 → { success: false, error }                        bad request
//   401 → { success: false, error, code: "..." }           expired / invalid
//   403 → { success: false, error, code: "OTP_LOCKED" }    3 wrong attempts
//   429 → { success: false, error, code: "OTP_LOCKED",     rate-limit style
//            lockedUntil }
//   500 → { success: false, error: "Internal server error" }
//
// OTP lock behaviour:
//   - Each wrong guess increments the attempts counter on the OtpCode record.
//   - On the 3rd wrong guess, expiresAt is extended by 15 min (the lock window).
//   - Subsequent calls return OTP_LOCKED with a lockedUntil timestamp.
//   - The lock is OTP-scoped (not account-scoped) — a correct code after the
//     lock period is impossible because the OTP itself has expired.
//   - To try again, the user must restart the login flow (get a new mfaPendingToken
//     and a new OTP via /api/auth/login).
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    // ── 1. Parse body ────────────────────────────────────────────────────────
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const mfaPendingToken = typeof body.mfaPendingToken === "string" ? body.mfaPendingToken : null;
    const otp             = typeof body.otp             === "string" ? body.otp.trim()       : null;
    const shouldTrust     = body.trustDevice === true;

    if (!mfaPendingToken || !otp) {
      return NextResponse.json(
        { success: false, error: "mfaPendingToken and otp are required" },
        { status: 400 }
      );
    }

    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json(
        { success: false, error: "OTP must be a 6-digit number" },
        { status: 400 }
      );
    }

    // ── 2. Verify the MFA pending token ──────────────────────────────────────
    // This is a short-lived JWT (10 min) that proves the user already passed
    // the password check. It does NOT grant access — only OTP success does.
    let pending: Awaited<ReturnType<typeof verifyMfaPendingToken>>;
    try {
      pending = await verifyMfaPendingToken(mfaPendingToken);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:   "MFA session has expired. Please log in again.",
          code:    "MFA_SESSION_EXPIRED",
        },
        { status: 401 }
      );
    }

    const staffId = pending.sub;

    // ── 3. Validate OTP ───────────────────────────────────────────────────────
    const result = await validateOtp(staffId, otp, OtpPurpose.MFA);

    if (!result.ok) {
      switch (result.reason) {
        case "NOT_FOUND":
          return NextResponse.json(
            {
              success: false,
              error:   "No active OTP found. Please log in again to receive a new code.",
              code:    "OTP_NOT_FOUND",
            },
            { status: 401 }
          );

        case "EXPIRED":
          return NextResponse.json(
            {
              success: false,
              error:   "OTP has expired. Please log in again to receive a new code.",
              code:    "OTP_EXPIRED",
            },
            { status: 401 }
          );

        case "LOCKED":
          return NextResponse.json(
            {
              success:     false,
              error:       "Too many incorrect attempts. Please wait before trying again.",
              code:        "OTP_LOCKED",
              lockedUntil: result.lockedUntil?.toISOString(),
            },
            { status: 429 }
          );

        case "INVALID":
          return NextResponse.json(
            {
              success:           false,
              error:             result.attemptsRemaining === 0
                ? "Too many incorrect attempts. Please wait 15 minutes before trying again."
                : "Incorrect OTP code.",
              code:              result.attemptsRemaining === 0 ? "OTP_LOCKED" : "INVALID_OTP",
              attemptsRemaining: result.attemptsRemaining,
            },
            { status: result.attemptsRemaining === 0 ? 429 : 401 }
          );
      }
    }

    // ── 4. Load fresh staff record ────────────────────────────────────────────
    const staff = await prisma.staff.findUnique({
      where:  { id: staffId },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, status: true, isLocked: true, department: true,
      },
    });

    if (!staff) {
      return NextResponse.json(
        { success: false, error: "Account not found", code: "ACCOUNT_NOT_FOUND" },
        { status: 401 }
      );
    }
    if (staff.isLocked) {
      return NextResponse.json(
        { success: false, error: "Account is locked. Contact your administrator.", code: "ACCOUNT_LOCKED" },
        { status: 403 }
      );
    }
    if (staff.status !== "ACTIVE") {
      return NextResponse.json(
        { success: false, error: "Account is inactive.", code: "ACCOUNT_INACTIVE" },
        { status: 403 }
      );
    }

    // ── 5. Device fingerprint + optional trust ────────────────────────────────
    const userAgent   = req.headers.get("user-agent") ?? "";
    const ip          =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";
    const fingerprint = buildDeviceFingerprint(userAgent, ip);
    const deviceLabel = parseDeviceLabel(userAgent);

    if (shouldTrust) {
      // Store fingerprint → future logins from this device skip OTP for 30 days
      await trustDevice(staffId, fingerprint, deviceLabel);
    }

    // ── 6. Issue tokens ───────────────────────────────────────────────────────
    const jti       = randomUUID();
    const expiresAt = new Date(Date.now() + REFRESH_TTL * 1000);

    const [accessToken, refreshToken] = await Promise.all([
      generateAccessToken({
        id:        staff.id,
        jti,
        email:     staff.email,
        role:      staff.role,
        firstName: staff.firstName,
        lastName:  staff.lastName,
      }),
      generateRefreshToken(staff.id, jti),
    ]);

    // Persist refresh token + open session atomically
    await prisma.$transaction([
      prisma.refreshToken.create({
        data: { jti, staffId: staff.id, expiresAt },
      }),
    ]);

    await createSession({ staffId: staff.id, jti, ipAddress: ip, userAgent, deviceLabel });

    // Log success event — fire-and-forget
    logLoginEvent({ staffId: staff.id, ipAddress: ip, userAgent, fingerprint, success: true })
      .catch(() => null);

    // Set refresh token in httpOnly cookie — never in response body
    await setRefreshCookie(refreshToken);

    // ── 7. Return flat response (matches login + refresh shape) ──────────────
    return NextResponse.json({
      success:     true,
      accessToken,
      mfaRequired: false,
      user: {
        id:         staff.id,
        name:       `${staff.firstName} ${staff.lastName}`.trim(),
        role:       staff.role,
        email:      staff.email,
        firstName:  staff.firstName,
        lastName:   staff.lastName,
        department: staff.department,
      },
    });
  } catch (err) {
    console.error("[auth/verify-otp] Unhandled error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
