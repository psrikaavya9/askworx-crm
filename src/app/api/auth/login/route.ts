import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { PrismaClientKnownRequestError, PrismaClientInitializationError } from "@prisma/client/runtime/client";
import {
  generateAccessToken,
  generateRefreshToken,
  generateMfaPendingToken,
  setRefreshCookie,
  REFRESH_TTL,
} from "@/lib/auth";
import {
  buildDeviceFingerprint,
  parseDeviceLabel,
  isTrustedDevice,
  createSession,
  logLoginEvent,
} from "@/lib/session";
import { isPasswordExpired } from "@/lib/password";
import { createOtp } from "@/lib/mfa";
import { randomUUID } from "crypto";
import { logAudit } from "@/lib/audit";

// ---------------------------------------------------------------------------
// POST /api/auth/login
//
// Body: { email?: string; phone?: string; password: string }
//       OR { identifier: string; isPhone?: boolean; password: string }
//
// Responses:
//   200 → { success: true,  accessToken, user: { id, name, role }, mfaRequired: false }
//   202 → { success: false, mfaRequired: true, mfaPendingToken }
//   400 → { success: false, error }
//   401 → { success: false, error, code: "INVALID_CREDENTIALS" }
//   403 → { success: false, error, code: "ACCOUNT_LOCKED" | "ACCOUNT_INACTIVE" | ... }
//   500 → { success: false, error: "Internal server error" }
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Pre-flight: catch missing env vars at handler registration time, not at
// request time, so the error shows up immediately in server logs on startup.
// ---------------------------------------------------------------------------
if (!process.env.JWT_SECRET) {
  console.error("[auth/login] FATAL: JWT_SECRET environment variable is not set. Login will fail for every request.");
}

export async function POST(req: NextRequest) {
  // Current execution step — updated before each async operation so the catch
  // block can log exactly which step threw without wrapping every call.
  let step = "parse-body";

  // ── 1. Parse body ──────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    console.warn("[auth/login] Bad request: invalid JSON body");
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  // Normalise: accept { email, phone } or { identifier, isPhone }
  const email      = typeof body.email      === "string" ? body.email.toLowerCase().trim()  : null;
  const phone      = typeof body.phone      === "string" ? body.phone.trim()                : null;
  const identifier = typeof body.identifier === "string" ? body.identifier.trim()           : null;
  const isPhone    = body.isPhone === true || (!!phone && !email);
  const password   = typeof body.password   === "string" ? body.password                    : "";

  // Resolve the two possible lookup values
  const lookupEmail = email ?? (identifier && !isPhone ? identifier.toLowerCase() : null);
  const lookupPhone = phone ?? (identifier &&  isPhone ? identifier               : null);

  if (!lookupEmail && !lookupPhone) {
    return NextResponse.json(
      { success: false, error: "email or phone is required" },
      { status: 400 }
    );
  }
  if (!password) {
    return NextResponse.json(
      { success: false, error: "password is required" },
      { status: 400 }
    );
  }

  // ── 2. Device detection ───────────────────────────────────────────────────
  const userAgent   = req.headers.get("user-agent") ?? "";
  const ip          =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  const fingerprint = buildDeviceFingerprint(userAgent, ip);
  const deviceLabel = parseDeviceLabel(userAgent);

  try {
    // ── 3. Lookup staff ────────────────────────────────────────────────────
    step = "db-lookup";
    const orClauses: { email?: string; phone?: string }[] = [];
    if (lookupEmail) orClauses.push({ email: lookupEmail });
    if (lookupPhone) orClauses.push({ phone: lookupPhone });

    const staff = await prisma.staff.findFirst({
      where: { OR: orClauses },
      select: {
        id:                 true,
        email:              true,
        phone:              true,
        firstName:          true,
        lastName:           true,
        department:         true,
        role:               true,
        status:             true,
        passwordHash:       true,
        isLocked:           true,
        isMfaEnabled:       true,
        forcePasswordReset: true,
        passwordChangedAt:  true,
        mfaFailures:        true,
      },
    });

    // ── 4. User not found ─────────────────────────────────────────────────
    // "Invalid email" — deliberate per product requirement.
    // Note: this leaks whether the email exists (user-enumeration risk).
    // If this is a concern, merge with the wrong-password branch and use
    // a single "Invalid credentials" message instead.
    if (!staff) {
      console.info(`[auth/login] User not found — identifier=${lookupEmail ?? lookupPhone}`);
      return NextResponse.json(
        { success: false, error: "Invalid email or phone number", code: "INVALID_CREDENTIALS" },
        { status: 401 }
      );
    }

    if (!staff.passwordHash) {
      // Password hash missing — account created without one (SSO import, etc.)
      console.warn(`[auth/login] staffId=${staff.id} has no passwordHash — cannot login with password`);
      return NextResponse.json(
        { success: false, error: "Password login is not configured for this account.", code: "INVALID_CREDENTIALS" },
        { status: 401 }
      );
    }

    // ── 5. Pre-password-check guards ─────────────────────────────────────
    if (staff.isLocked) {
      console.info(`[auth/login] staffId=${staff.id} is locked`);
      return NextResponse.json(
        { success: false, error: "Account locked. Contact your administrator.", code: "ACCOUNT_LOCKED" },
        { status: 403 }
      );
    }

    if (staff.status !== "ACTIVE") {
      console.info(`[auth/login] staffId=${staff.id} is not active (status=${staff.status})`);
      return NextResponse.json(
        { success: false, error: "Account is inactive.", code: "ACCOUNT_INACTIVE" },
        { status: 403 }
      );
    }

    // ── 6. Password comparison ────────────────────────────────────────────
    step = "bcrypt-compare";
    const passwordOk = await bcrypt.compare(password, staff.passwordHash);

    if (!passwordOk) {
      step = "failure-counter";
      const { mfaFailures: newCount } = await prisma.staff.update({
        where:  { id: staff.id },
        data:   { mfaFailures: { increment: 1 } },
        select: { mfaFailures: true },
      });

      // Fire-and-forget — must not throw into the main handler
      logLoginEvent({ staffId: staff.id, ipAddress: ip, userAgent, fingerprint, success: false, failReason: "BAD_PASSWORD" })
        .catch((e) => console.error("[auth/login] logLoginEvent failed:", e));

      logAudit(staff.id, "LOGIN_FAILED", "auth", staff.id, { reason: "BAD_PASSWORD", ip });

      if (newCount >= 5) {
        step = "auto-lock";
        await prisma.staff.update({
          where: { id: staff.id },
          data:  { isLocked: true, lockedAt: new Date(), lockedBy: "auto-lock" },
        });
        console.info(`[auth/login] staffId=${staff.id} auto-locked after ${newCount} failures`);
        return NextResponse.json(
          { success: false, error: "Account locked after too many failed attempts.", code: "ACCOUNT_LOCKED" },
          { status: 403 }
        );
      }

      console.info(`[auth/login] Wrong password for staffId=${staff.id} — failures=${newCount}`);
      return NextResponse.json(
        { success: false, error: "Wrong password", code: "INVALID_CREDENTIALS" },
        { status: 401 }
      );
    }

    // ── 7. Password correct — reset failure counter ───────────────────────
    step = "reset-failure-counter";
    await prisma.staff.update({
      where: { id: staff.id },
      data:  { mfaFailures: 0 },
    });

    // ── 8. Force password reset ───────────────────────────────────────────
    if (staff.forcePasswordReset) {
      step = "force-reset-token";
      const mfaPendingToken = await generateMfaPendingToken(staff.id);
      return NextResponse.json(
        { success: false, code: "FORCE_PASSWORD_RESET", error: "You must change your password before continuing.", mfaPendingToken },
        { status: 403 }
      );
    }

    // ── 9. Password expiry (OWNER / SUPER_ADMIN: 90-day policy) ──────────
    if (isPasswordExpired(staff.role, staff.passwordChangedAt)) {
      step = "expiry-token";
      const mfaPendingToken = await generateMfaPendingToken(staff.id);
      return NextResponse.json(
        { success: false, code: "PASSWORD_EXPIRED", error: "Your password has expired. Please reset it.", mfaPendingToken },
        { status: 403 }
      );
    }

    // ── 10. MFA gate ──────────────────────────────────────────────────────
    const mfaRequired =
      staff.isMfaEnabled ||
      staff.role === "OWNER" ||
      staff.role === "SUPER_ADMIN";

    if (mfaRequired) {
      step = "trusted-device-check";
      const trusted = await isTrustedDevice(staff.id, fingerprint);

      if (!trusted) {
        step = "otp-create";
        const [mfaPendingToken, otp] = await Promise.all([
          generateMfaPendingToken(staff.id),
          createOtp(staff.id, "MFA"),
        ]);

        if (process.env.NODE_ENV !== "production") {
          console.log(`[DEV] MFA OTP for ${staff.email}: ${otp}`);
        }

        return NextResponse.json(
          {
            success:         false,
            mfaRequired:     true,
            mfaPendingToken,
            ...(process.env.NODE_ENV !== "production" ? { devOtp: otp } : {}),
          },
          { status: 202 }
        );
      }
    }

    // ── 11. Issue tokens ──────────────────────────────────────────────────
    step = "generate-tokens";
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

    // ── 12. Persist refresh token ────────────────────────────────────────
    step = "persist-refresh-token";
    await prisma.refreshToken.create({
      data: { jti, staffId: staff.id, expiresAt },
    });

    // ── 13. Create session ────────────────────────────────────────────────
    step = "create-session";
    await createSession({ staffId: staff.id, jti, ipAddress: ip, userAgent, deviceLabel });

    // ── 14. Set cookie ────────────────────────────────────────────────────
    step = "set-cookie";
    await setRefreshCookie(refreshToken);

    // Fire-and-forget login success event
    logLoginEvent({ staffId: staff.id, ipAddress: ip, userAgent, fingerprint, success: true })
      .then((suspicious) => {
        if (suspicious) console.warn(`[SUSPICIOUS LOGIN] staffId=${staff.id} ip=${ip}`);
      })
      .catch((e) => console.error("[auth/login] logLoginEvent (success) failed:", e));

    logAudit(staff.id, "LOGIN_SUCCESS", "auth", staff.id, { ip, deviceLabel });

    // ── 15. Return ────────────────────────────────────────────────────────
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
    // ── Discriminated error handling ──────────────────────────────────────
    //
    // Log the real error with the step that failed so issues are immediately
    // locatable in server logs without guessing.
    const message = err instanceof Error ? err.message : String(err);
    const stack   = err instanceof Error ? err.stack   : undefined;

    // Prisma DB connectivity / startup error
    if (err instanceof PrismaClientInitializationError) {
      console.error(`[auth/login][${step}] Database connection failed:`, message);
      return NextResponse.json(
        { success: false, error: "Service temporarily unavailable. Please try again." },
        { status: 503 }
      );
    }

    // Prisma constraint / query error — includes FK violations, unique conflicts
    if (err instanceof PrismaClientKnownRequestError) {
      console.error(`[auth/login][${step}] Prisma error ${err.code}:`, message, err.meta);
      return NextResponse.json(
        { success: false, error: "Internal server error" },
        { status: 500 }
      );
    }

    // JWT_SECRET not configured
    if (message.includes("JWT_SECRET is not configured")) {
      console.error(`[auth/login][${step}] JWT_SECRET missing — set it in .env`);
      return NextResponse.json(
        { success: false, error: "Server is not properly configured. Contact your administrator." },
        { status: 500 }
      );
    }

    // Any other unexpected error — log stack for full trace
    console.error(`[auth/login][${step}] Unhandled error:`, message);
    if (stack) console.error(stack);

    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
