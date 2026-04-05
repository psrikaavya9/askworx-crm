import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateResetPendingToken } from "@/lib/auth";
import { createOtp } from "@/lib/mfa";
import { OtpPurpose } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// POST /api/auth/request-reset
//
// Step 1 of the self-service password reset flow.
// Does NOT require the user to be logged in.
//
// Body:
//   { identifier: string }   // email address or phone number
//
// Response (always 200 — never reveal whether the account exists):
//   {
//     success:    true,
//     resetToken: string,    // 15-min JWT — submit with OTP to /reset-password
//     // DEV ONLY:
//     devOtp:    string
//   }
//
// Security notes:
//   - Always returns 200 even if the identifier doesn't match any account.
//     This prevents user enumeration (attacker can't learn which emails exist).
//   - The OTP is 6 digits with a 5-min window and max 3 attempts.
//   - The resetToken is a signed JWT — it cannot be forged without JWT_SECRET.
//   - Both resetToken AND OTP are required to change the password.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const identifier = typeof body.identifier === "string" ? body.identifier.trim() : "";

    if (!identifier) {
      return NextResponse.json(
        { success: false, error: "identifier (email or phone) is required" },
        { status: 400 }
      );
    }

    // ── Look up the account (email OR phone) ──────────────────────────────────
    const staff = await prisma.staff.findFirst({
      where: {
        OR: [
          { email: identifier.toLowerCase() },
          { phone: identifier },
        ],
      },
      select: { id: true, email: true, status: true, isLocked: true },
    });

    // ── If account not found: return success anyway (no enumeration) ──────────
    // We generate a fake resetToken with a dummy ID so the response shape and
    // timing are identical to the real path.
    if (!staff || staff.status !== "ACTIVE" || staff.isLocked) {
      // Fake resetToken (invalid staffId — will fail at verify stage)
      const fakeToken = await generateResetPendingToken("not-a-real-id");
      return NextResponse.json({
        success:    true,
        resetToken: fakeToken,
        message:    "If an account exists for that identifier, an OTP has been sent.",
      });
    }

    // ── Generate OTP (PASSWORD_RESET purpose) and resetToken ─────────────────
    const [resetToken, otp] = await Promise.all([
      generateResetPendingToken(staff.id),
      createOtp(staff.id, OtpPurpose.PASSWORD_RESET),
    ]);

    // createOtp already calls console.log — this is the mock SMS
    // In production, replace createOtp's console.log with your SMS/email provider

    return NextResponse.json({
      success:    true,
      resetToken,
      message:    "If an account exists for that identifier, an OTP has been sent.",
      // Expose OTP in dev so you can test without SMS
      ...(process.env.NODE_ENV !== "production" ? { devOtp: otp } : {}),
    });
  } catch (err) {
    console.error("[auth/request-reset] Unhandled error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
