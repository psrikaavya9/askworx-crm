// ---------------------------------------------------------------------------
// session.ts — Session management, device fingerprinting, login event logging
// ---------------------------------------------------------------------------

import crypto from "crypto";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_ACTIVE_SESSIONS    = 2;
const INACTIVITY_TIMEOUT_MS  = 30 * 60 * 1000; // 30 minutes
const TRUSTED_DEVICE_TTL_DAYS = 30;

// ---------------------------------------------------------------------------
// Device fingerprinting & parsing
// ---------------------------------------------------------------------------

/** sha256(userAgent + ip) — used to identify a device without storing raw UA */
export function buildDeviceFingerprint(userAgent: string, ip: string): string {
  return crypto
    .createHash("sha256")
    .update(`${userAgent}|${ip}`)
    .digest("hex");
}

export interface DeviceInfo {
  browser:     string;   // e.g. "Chrome", "Firefox", "Safari"
  deviceName:  string;   // e.g. "Windows", "macOS", "iPhone"
  deviceLabel: string;   // combined e.g. "Chrome on Windows"
}

/**
 * Parses a User-Agent string into structured device info.
 * Returns structured { browser, deviceName, deviceLabel }.
 */
export function parseDeviceInfo(userAgent: string): DeviceInfo {
  const ua = userAgent.toLowerCase();

  let browser = "Browser";
  if      (ua.includes("edg"))                           browser = "Edge";
  else if (ua.includes("chrome") && !ua.includes("edg")) browser = "Chrome";
  else if (ua.includes("firefox"))                       browser = "Firefox";
  else if (ua.includes("safari") && !ua.includes("chrome")) browser = "Safari";
  else if (ua.includes("opera") || ua.includes("opr"))   browser = "Opera";

  let deviceName = "Unknown Device";
  if      (ua.includes("iphone"))  deviceName = "iPhone";
  else if (ua.includes("ipad"))    deviceName = "iPad";
  else if (ua.includes("android")) deviceName = "Android";
  else if (ua.includes("windows")) deviceName = "Windows";
  else if (ua.includes("mac"))     deviceName = "macOS";
  else if (ua.includes("linux"))   deviceName = "Linux";

  return { browser, deviceName, deviceLabel: `${browser} on ${deviceName}` };
}

/** Convenience — returns just the combined label string (backwards compat). */
export function parseDeviceLabel(userAgent: string): string {
  return parseDeviceInfo(userAgent).deviceLabel;
}

// ---------------------------------------------------------------------------
// Trusted devices
// ---------------------------------------------------------------------------

export async function isTrustedDevice(
  staffId:     string,
  fingerprint: string
): Promise<boolean> {
  const device = await prisma.trustedDevice.findUnique({
    where:  { staffId_fingerprint: { staffId, fingerprint } },
    select: { expiresAt: true },
  });
  return !!device && device.expiresAt > new Date();
}

export async function trustDevice(
  staffId:     string,
  fingerprint: string,
  label:       string
): Promise<void> {
  const expiresAt = new Date(Date.now() + TRUSTED_DEVICE_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.trustedDevice.upsert({
    where:  { staffId_fingerprint: { staffId, fingerprint } },
    create: { staffId, fingerprint, label, expiresAt },
    update: { label, expiresAt },
  });
}

export async function revokeTrustedDevice(staffId: string, fingerprint: string): Promise<void> {
  await prisma.trustedDevice.deleteMany({ where: { staffId, fingerprint } });
}

// ---------------------------------------------------------------------------
// Session creation — enforces MAX 2 active sessions per user
//
// If a 3rd login would create a 3rd session, the oldest active session is
// revoked first, keeping the total at MAX_ACTIVE_SESSIONS.
// ---------------------------------------------------------------------------

export async function createSession(opts: {
  staffId:      string;
  jti:          string;
  ipAddress?:   string;
  userAgent?:   string;
  deviceLabel?: string;
}): Promise<void> {
  const { staffId, jti, ipAddress, userAgent, deviceLabel } = opts;

  // Parse browser + deviceName from UA for the new session
  const info = userAgent ? parseDeviceInfo(userAgent) : null;

  // Find all currently active sessions, oldest first
  const activeSessions = await prisma.session.findMany({
    where:   { staffId, revokedAt: null },
    orderBy: { createdAt: "asc" },
    select:  { id: true },
  });

  // Evict the oldest session(s) to stay within the limit
  if (activeSessions.length >= MAX_ACTIVE_SESSIONS) {
    const excess = activeSessions.length - MAX_ACTIVE_SESSIONS + 1;
    const toEvict = activeSessions.slice(0, excess).map((s) => s.id);
    await prisma.session.updateMany({
      where: { id: { in: toEvict } },
      data:  { revokedAt: new Date() },
    });
  }

  await prisma.session.create({
    data: {
      staffId,
      jti,
      ipAddress,
      userAgent,
      browser:     info?.browser,
      deviceName:  info?.deviceName,
      deviceLabel: deviceLabel ?? info?.deviceLabel,
    },
  });
}

// ---------------------------------------------------------------------------
// Session validation
//
// Called on EVERY authenticated request (inside withAuth).
// - Rejects revoked sessions immediately.
// - Rejects sessions inactive > 30 min (auto-revokes them in DB).
// ---------------------------------------------------------------------------

export type SessionValidationResult =
  | { valid: true }
  | { valid: false; reason: "NOT_FOUND" | "REVOKED" | "INACTIVE" };

export async function validateSession(jti: string): Promise<SessionValidationResult> {
  const session = await prisma.session.findUnique({
    where:  { jti },
    select: { revokedAt: true, lastActiveAt: true },
  });

  if (!session)          return { valid: false, reason: "NOT_FOUND" };
  if (session.revokedAt) return { valid: false, reason: "REVOKED" };

  const idleMs = Date.now() - session.lastActiveAt.getTime();
  if (idleMs > INACTIVITY_TIMEOUT_MS) {
    // Auto-revoke the session so subsequent calls also fail immediately
    await prisma.session.update({
      where: { jti },
      data:  { revokedAt: new Date() },
    });
    return { valid: false, reason: "INACTIVE" };
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// Session activity update — called fire-and-forget after every valid request
// ---------------------------------------------------------------------------

export async function touchSession(jti: string): Promise<void> {
  await prisma.session.updateMany({
    where: { jti, revokedAt: null },
    data:  { lastActiveAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Session revocation
// ---------------------------------------------------------------------------

export async function revokeSession(jti: string): Promise<void> {
  await prisma.session.updateMany({
    where: { jti },
    data:  { revokedAt: new Date() },
  });
}

export async function revokeAllSessions(staffId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { staffId, revokedAt: null },
    data:  { revokedAt: new Date() },
  });
}

/** Called during refresh token rotation to keep session.jti in sync. */
export async function rotateSessionJti(oldJti: string, newJti: string): Promise<void> {
  await prisma.session.updateMany({
    where: { jti: oldJti },
    data:  { jti: newJti, lastActiveAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Login event logging + suspicious login detection
// ---------------------------------------------------------------------------

export async function logLoginEvent(opts: {
  staffId:     string;
  ipAddress?:  string;
  userAgent?:  string;
  fingerprint?: string;
  success:     boolean;
  failReason?: string;
}): Promise<boolean> {
  const { staffId, ipAddress, userAgent, fingerprint, success, failReason } = opts;

  // Suspicious = successful login from a fingerprint never seen before for this user
  let suspicious = false;
  if (success && fingerprint) {
    const prev = await prisma.loginEvent.findFirst({
      where:   { staffId, success: true, fingerprint },
      orderBy: { createdAt: "desc" },
    });
    if (!prev) suspicious = true;
  }

  await prisma.loginEvent.create({
    data: { staffId, ipAddress, userAgent, fingerprint, success, failReason, suspicious },
  });

  return suspicious;
}
