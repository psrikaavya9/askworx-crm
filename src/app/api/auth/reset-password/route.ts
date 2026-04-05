import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyMfaPendingToken,
  verifyResetPendingToken,
  clearRefreshCookie,
} from "@/lib/auth";
import {
  validatePasswordStrength,
  isPasswordReused,
  updatePassword,
} from "@/lib/password";
import { validateOtp } from "@/lib/mfa";
import { revokeAllSessions } from "@/lib/session";
import { OtpPurpose } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// POST /api/auth/reset-password
//
// Step 2 of the password reset flow. Handles two distinct scenarios:
//
// ── Scenario A: Self-service (forgot password) ─────────────────────────────
//   User ran /api/auth/request-reset first and has:
//     - resetToken (from request-reset response)
//     - otp        (6-digit code from console / SMS)
//
//   Body: { resetToken, otp, newPassword, confirmPassword }
//
// ── Scenario B: Forced reset / expired password (triggered at login) ───────
//   User was blocked at login with FORCE_PASSWORD_RESET or PASSWORD_EXPIRED.
//   The login response contained a mfaPendingToken.
//   No OTP needed — password check at login already proved identity.
//
//   Body: { mfaPendingToken, newPassword, confirmPassword }
//
// Both scenarios:
//   - Validate password strength (8+ chars, uppercase, number, special char)
//   - Reject if new password matches any of the last 5 passwords
//   - Update passwordHash + passwordChangedAt + forcePasswordReset=false
//   - Revoke all existing sessions and refresh tokens
//   - Clear the refresh cookie
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

    const resetToken     = typeof body.resetToken      === "string" ? body.resetToken      : null;
    const mfaPendingTok  = typeof body.mfaPendingToken === "string" ? body.mfaPendingToken : null;
    const otp            = typeof body.otp             === "string" ? body.otp.trim()       : null;
    const newPassword    = typeof body.newPassword     === "string" ? body.newPassword     : "";
    const confirmPass    = typeof body.confirmPassword === "string" ? body.confirmPassword : "";

    if (!newPassword || !confirmPass) {
      return NextResponse.json(
        { success: false, error: "newPassword and confirmPassword are required" },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPass) {
      return NextResponse.json(
        { success: false, error: "Passwords do not match" },
        { status: 400 }
      );
    }

    // ── 2. Identify the staff member + verify intent token ───────────────────
    let staffId: string;
    let requireOtp: boolean;

    if (resetToken) {
      // ── Scenario A: self-service forgot-password ──────────────────────────
      // Verify the resetToken JWT first; the OTP check comes next
      try {
        const payload = await verifyResetPendingToken(resetToken);
        staffId   = payload.sub;
        requireOtp = true;
      } catch {
        return NextResponse.json(
          {
            success: false,
            error:   "Reset session has expired. Please request a new OTP.",
            code:    "RESET_TOKEN_EXPIRED",
          },
          { status: 401 }
        );
      }
    } else if (mfaPendingTok) {
      // ── Scenario B: forced reset / expired password at login ──────────────
      // mfaPendingToken was issued after successful password check → no OTP needed
      try {
        const payload = await verifyMfaPendingToken(mfaPendingTok);
        staffId   = payload.sub;
        requireOtp = false;
      } catch {
        return NextResponse.json(
          {
            success: false,
            error:   "Session expired. Please log in again.",
            code:    "SESSION_EXPIRED",
          },
          { status: 401 }
        );
      }
    } else {
      return NextResponse.json(
        {
          success: false,
          error:   "Provide either resetToken (forgot password) or mfaPendingToken (forced reset)",
        },
        { status: 400 }
      );
    }

    // ── 3. Validate OTP (Scenario A only) ───────────────────────────────────
    if (requireOtp) {
      if (!otp) {
        return NextResponse.json(
          { success: false, error: "otp is required when using resetToken" },
          { status: 400 }
        );
      }

      if (!/^\d{6}$/.test(otp)) {
        return NextResponse.json(
          { success: false, error: "OTP must be a 6-digit number" },
          { status: 400 }
        );
      }

      const otpResult = await validateOtp(staffId, otp, OtpPurpose.PASSWORD_RESET);

      if (!otpResult.ok) {
        switch (otpResult.reason) {
          case "NOT_FOUND":
            return NextResponse.json(
              {
                success: false,
                error:   "No active OTP found. Please request a new one.",
                code:    "OTP_NOT_FOUND",
              },
              { status: 401 }
            );
          case "EXPIRED":
            return NextResponse.json(
              {
                success: false,
                error:   "OTP has expired. Please request a new one.",
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
                lockedUntil: otpResult.lockedUntil?.toISOString(),
              },
              { status: 429 }
            );
          case "INVALID":
            return NextResponse.json(
              {
                success:           false,
                error:             otpResult.attemptsRemaining === 0
                  ? "Too many incorrect attempts. Please wait before trying again."
                  : "Incorrect OTP code.",
                code:              otpResult.attemptsRemaining === 0 ? "OTP_LOCKED" : "INVALID_OTP",
                attemptsRemaining: otpResult.attemptsRemaining,
              },
              { status: otpResult.attemptsRemaining === 0 ? 429 : 401 }
            );
        }
      }
    }

    // ── 4. Verify staff account is still valid ───────────────────────────────
    const staff = await prisma.staff.findUnique({
      where:  { id: staffId },
      select: { id: true, isLocked: true, status: true },
    });

    if (!staff) {
      return NextResponse.json(
        { success: false, error: "Account not found", code: "ACCOUNT_NOT_FOUND" },
        { status: 404 }
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

    // ── 5. Validate password strength ─────────────────────────────────────────
    const strength = validatePasswordStrength(newPassword);
    if (!strength.valid) {
      return NextResponse.json(
        {
          success: false,
          error:   "Password does not meet requirements",
          code:    "WEAK_PASSWORD",
          reasons: strength.errors,
        },
        { status: 400 }
      );
    }

    // ── 6. Check password history (last 5) ────────────────────────────────────
    const reused = await isPasswordReused(staffId, newPassword);
    if (reused) {
      return NextResponse.json(
        {
          success: false,
          error:   "You cannot reuse any of your last 5 passwords",
          code:    "PASSWORD_REUSED",
        },
        { status: 400 }
      );
    }

    // ── 7. Update password (hash + history + clear forcePasswordReset flag) ───
    await updatePassword(staffId, newPassword);

    // ── 8. Revoke all sessions and refresh tokens (force full re-login) ───────
    // This signs the user out of every device — new password required everywhere.
    await revokeAllSessions(staffId);
    await prisma.refreshToken.updateMany({
      where: { staffId, revokedAt: null },
      data:  { revokedAt: new Date() },
    });

    // Clear the refresh cookie if it belongs to this user (best-effort)
    await clearRefreshCookie().catch(() => null);

    return NextResponse.json({
      success: true,
      message: "Password updated successfully. Please log in with your new password.",
    });
  } catch (err) {
    console.error("[auth/reset-password] Unhandled error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
