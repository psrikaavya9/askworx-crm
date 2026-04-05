// ---------------------------------------------------------------------------
// mfa.ts — OTP generation, validation, attempt tracking
// ---------------------------------------------------------------------------

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { OtpPurpose } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const OTP_TTL_SECONDS   = 5 * 60;   // 5 minutes — valid window for correct code
export const OTP_LOCK_SECONDS  = 15 * 60;  // 15 minutes — lock after MAX_OTP_ATTEMPTS failures
export const MAX_OTP_ATTEMPTS  = 3;        // wrong guesses before OTP is locked

// ---------------------------------------------------------------------------
// OTP generation — cryptographically secure
// ---------------------------------------------------------------------------

/**
 * Returns a random 6-digit string using Node's crypto.randomInt.
 * crypto.randomInt is cryptographically secure (CSPRNG), unlike Math.random().
 */
export function generateOtpCode(): string {
  // randomInt(min, max) — max is exclusive, so 100000–999999 gives exactly 6 digits
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Creates a new OTP for the given staff member and purpose.
 * - Invalidates any existing unused OTPs for the same user + purpose first.
 * - Returns the plaintext code (caller is responsible for sending it).
 * - Logs to console (mock SMS/email for dev).
 */
export async function createOtp(
  staffId: string,
  purpose: OtpPurpose
): Promise<string> {
  const code      = generateOtpCode();
  const codeHash  = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

  // Invalidate all existing unused OTPs for this user+purpose so only one is active
  await prisma.otpCode.updateMany({
    where: { staffId, purpose, usedAt: null },
    data:  { usedAt: new Date() },
  });

  await prisma.otpCode.create({
    data: { staffId, codeHash, purpose, expiresAt },
  });

  // Mock SMS / email — replace with real provider in production
  console.log(`[MFA] OTP for staffId=${staffId} purpose=${purpose}: ${code}`);

  return code;
}

// ---------------------------------------------------------------------------
// OTP validation
// ---------------------------------------------------------------------------

export type OtpValidationResult =
  | { ok: true }
  | { ok: false; reason: "NOT_FOUND" | "EXPIRED" | "LOCKED"; lockedUntil?: Date }
  | { ok: false; reason: "INVALID"; attemptsRemaining: number };

/**
 * Validates a plaintext OTP code.
 *
 * Attempt tracking is done on the OtpCode record itself (not on Staff),
 * so failures are scoped to this specific OTP session — not the account.
 *
 * Flow:
 *   1. Find the active (unused) OTP for this user + purpose
 *   2. If attempts >= MAX_OTP_ATTEMPTS → return LOCKED (even if code is correct)
 *   3. If expired → return EXPIRED
 *   4. Increment attempts
 *   5. bcrypt.compare — if wrong:
 *        - If now at max attempts → extend expiresAt by 15 min (OTP lock period)
 *        - Return INVALID with remaining count
 *   6. If correct → mark as used, return ok
 */
export async function validateOtp(
  staffId: string,
  code:    string,
  purpose: OtpPurpose
): Promise<OtpValidationResult> {
  const otp = await prisma.otpCode.findFirst({
    where:   { staffId, purpose, usedAt: null },
    orderBy: { createdAt: "desc" },
  });

  // No active OTP exists
  if (!otp) return { ok: false, reason: "NOT_FOUND" };

  // Already at max attempts — OTP is locked regardless of correctness
  if (otp.attempts >= MAX_OTP_ATTEMPTS) {
    return {
      ok: false,
      reason:      "LOCKED",
      lockedUntil: otp.expiresAt,  // expiresAt was extended to lock-until on the 3rd failure
    };
  }

  // OTP window has passed
  if (otp.expiresAt < new Date()) {
    return { ok: false, reason: "EXPIRED" };
  }

  // Increment attempts before checking the code (prevents timing-based enumeration)
  const newAttempts = otp.attempts + 1;

  const match = await bcrypt.compare(code, otp.codeHash);

  if (!match) {
    // If this is the last allowed attempt, extend expiresAt to enforce the 15-min lock.
    // The next call will hit the attempts >= MAX check above and return LOCKED.
    const lockExtension = newAttempts >= MAX_OTP_ATTEMPTS
      ? { expiresAt: new Date(Date.now() + OTP_LOCK_SECONDS * 1000) }
      : {};

    await prisma.otpCode.update({
      where: { id: otp.id },
      data:  { attempts: newAttempts, ...lockExtension },
    });

    return {
      ok: false,
      reason:            "INVALID",
      attemptsRemaining: Math.max(0, MAX_OTP_ATTEMPTS - newAttempts),
    };
  }

  // Correct code — mark as consumed
  await prisma.otpCode.update({
    where: { id: otp.id },
    data:  { usedAt: new Date(), attempts: newAttempts },
  });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Account locking — for login failures, NOT for OTP failures
// (OTP failures use the per-OTP attempts/lock mechanism above)
// ---------------------------------------------------------------------------

/** Permanently lock an account. Can only be undone by an OWNER via /api/auth/unlock-account. */
export async function lockAccount(staffId: string, reason?: string): Promise<void> {
  await prisma.staff.update({
    where: { id: staffId },
    data:  { isLocked: true, lockedAt: new Date(), lockedBy: reason ?? null },
  });
}

/** Unlock an account — OWNER only (enforced at the API layer). */
export async function unlockAccount(staffId: string, unlockedBy: string): Promise<void> {
  await prisma.staff.update({
    where: { id: staffId },
    data:  { isLocked: false, lockedAt: null, lockedBy: unlockedBy, mfaFailures: 0 },
  });
}
