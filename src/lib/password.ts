// ---------------------------------------------------------------------------
// password.ts — Password policy, history, update, expiry
// ---------------------------------------------------------------------------

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { StaffRole } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SALT_ROUNDS      = 12;
const HISTORY_DEPTH    = 5;   // last N hashes checked for reuse
const OWNER_EXPIRY_DAYS = 90; // OWNER / SUPER_ADMIN must rotate every 90 days

// ---------------------------------------------------------------------------
// Password strength validation
//
// Rules (all must pass):
//   - Minimum 8 characters
//   - At least 1 uppercase letter  (A-Z)
//   - At least 1 digit             (0-9)
//   - At least 1 special character (anything not A-Z, a-z, 0-9)
// ---------------------------------------------------------------------------

export interface PasswordStrengthResult {
  valid:  boolean;
  errors: string[];  // human-readable failure reasons, empty when valid
}

export function validatePasswordStrength(password: string): PasswordStrengthResult {
  const errors: string[] = [];

  if (password.length < 8)
    errors.push("Password must be at least 8 characters");

  if (!/[A-Z]/.test(password))
    errors.push("Password must contain at least one uppercase letter");

  if (!/[0-9]/.test(password))
    errors.push("Password must contain at least one number");

  if (!/[^A-Za-z0-9]/.test(password))
    errors.push("Password must contain at least one special character (e.g. @, !, #)");

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Password history — prevent reuse of last 5 passwords
//
// Runs bcrypt.compare against each stored hash sequentially.
// Returns true (reused) as soon as a match is found.
// ---------------------------------------------------------------------------

export async function isPasswordReused(
  staffId:     string,
  newPassword: string
): Promise<boolean> {
  const history = await prisma.passwordHistory.findMany({
    where:   { staffId },
    orderBy: { createdAt: "desc" },
    take:    HISTORY_DEPTH,
    select:  { passwordHash: true },
  });

  for (const entry of history) {
    if (await bcrypt.compare(newPassword, entry.passwordHash)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// updatePassword
//
// 1. Hashes the new password (bcrypt, 12 rounds)
// 2. Updates Staff.passwordHash, passwordChangedAt, forcePasswordReset=false
// 3. Appends to PasswordHistory (in the same transaction)
// 4. Prunes PasswordHistory to HISTORY_DEPTH entries after the transaction
// ---------------------------------------------------------------------------

export async function updatePassword(
  staffId:     string,
  newPassword: string
): Promise<void> {
  const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  // Update staff + record history atomically
  await prisma.$transaction([
    prisma.staff.update({
      where: { id: staffId },
      data: {
        passwordHash:      hash,
        passwordChangedAt: new Date(),
        forcePasswordReset: false,
      },
    }),
    prisma.passwordHistory.create({
      data: { staffId, passwordHash: hash },
    }),
  ]);

  // Prune: keep only the most recent HISTORY_DEPTH entries
  // (run outside the transaction — non-critical housekeeping)
  const overflow = await prisma.passwordHistory.findMany({
    where:   { staffId },
    orderBy: { createdAt: "desc" },
    skip:    HISTORY_DEPTH,
    select:  { id: true },
  });

  if (overflow.length > 0) {
    await prisma.passwordHistory.deleteMany({
      where: { id: { in: overflow.map((e) => e.id) } },
    });
  }
}

// ---------------------------------------------------------------------------
// Password expiry (OWNER / SUPER_ADMIN only — 90-day policy)
//
// Returns true if the password is expired and must be reset before access.
// All other roles have no expiry.
// ---------------------------------------------------------------------------

export function isPasswordExpired(
  role:              StaffRole,
  passwordChangedAt: Date | null
): boolean {
  if (role !== "OWNER" && role !== "SUPER_ADMIN") return false;

  // null means password was never changed → treat as expired
  if (!passwordChangedAt) return true;

  const ageDays = (Date.now() - passwordChangedAt.getTime()) / (1000 * 60 * 60 * 24);
  return ageDays > OWNER_EXPIRY_DAYS;
}
