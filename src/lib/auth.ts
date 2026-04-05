import { cookies } from "next/headers";
import type { StaffRole } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Token payload types
// ---------------------------------------------------------------------------

export interface AccessTokenPayload {
  sub:       string;    // staff ID
  jti:       string;    // session jti — linked to Session + RefreshToken records
  email:     string;
  role:      StaffRole;
  firstName: string;
  lastName:  string;
  type:      "access";
  iat:       number;
  exp:       number;
}

export interface MfaPendingPayload {
  sub:  string;   // staff ID
  type: "mfa-pending";
  iat:  number;
  exp:  number;
}

export interface ResetPendingPayload {
  sub:  string;   // staff ID
  type: "reset-pending";
  iat:  number;
  exp:  number;
}

export interface RefreshTokenPayload {
  sub:  string;   // staff ID
  jti:  string;   // UUID stored in DB — used for revocation lookup
  type: "refresh";
  iat:  number;
  exp:  number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const ACCESS_TTL       = 8  * 60 * 60;       // 8 hours  (seconds)
export const REFRESH_TTL      = 30 * 24 * 60 * 60; // 30 days  (seconds)
export const MFA_PENDING_TTL  = 10 * 60;            // 10 minutes (seconds)
export const RESET_PENDING_TTL = 15 * 60;           // 15 minutes (seconds)
export const REFRESH_COOKIE   = "refresh_token";

// ---------------------------------------------------------------------------
// Internal JWT helpers — Web Crypto (no external dependencies)
// ---------------------------------------------------------------------------

function b64url(str: string): string {
  return Buffer.from(str, "utf8").toString("base64url");
}

async function getHmacKey(): Promise<CryptoKey> {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function signJWT<T extends object>(payload: T): Promise<string> {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body   = b64url(JSON.stringify(payload));
  const data   = `${header}.${body}`;
  const key    = await getHmacKey();
  const sig    = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return `${data}.${Buffer.from(sig).toString("base64url")}`;
}

async function decodeAndVerifyJWT<T>(token: string): Promise<T> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed token");

  const [header, payload, sig] = parts;
  const data  = `${header}.${payload}`;
  const key   = await getHmacKey();
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    Buffer.from(sig, "base64url"),
    new TextEncoder().encode(data)
  );
  if (!valid) throw new Error("Invalid token signature");

  let decoded: T & { exp?: number };
  try {
    decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as T & { exp?: number };
  } catch {
    throw new Error("Malformed token payload");
  }

  if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Token expired");
  }
  return decoded;
}

// ---------------------------------------------------------------------------
// generateAccessToken
// ---------------------------------------------------------------------------

export async function generateAccessToken(user: {
  id:        string;
  jti:       string;
  email:     string;
  role:      StaffRole;
  firstName: string;
  lastName:  string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return signJWT<AccessTokenPayload>({
    sub:       user.id,
    jti:       user.jti,
    email:     user.email,
    role:      user.role,
    firstName: user.firstName,
    lastName:  user.lastName,
    type:      "access",
    iat:       now,
    exp:       now + ACCESS_TTL,
  });
}

// ---------------------------------------------------------------------------
// generateMfaPendingToken / verifyMfaPendingToken
// ---------------------------------------------------------------------------

export async function generateMfaPendingToken(staffId: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return signJWT<MfaPendingPayload>({
    sub:  staffId,
    type: "mfa-pending",
    iat:  now,
    exp:  now + MFA_PENDING_TTL,
  });
}

export async function verifyMfaPendingToken(token: string): Promise<MfaPendingPayload> {
  const payload = await decodeAndVerifyJWT<MfaPendingPayload>(token);
  if (payload.type !== "mfa-pending") throw new Error("Not an MFA pending token");
  return payload;
}

// ---------------------------------------------------------------------------
// generateResetPendingToken / verifyResetPendingToken
//
// Issued by /api/auth/request-reset after the user is identified.
// Must be submitted alongside the OTP to /api/auth/reset-password.
// Separate type ("reset-pending") prevents MFA tokens being used as reset
// tokens and vice versa.
// ---------------------------------------------------------------------------

export async function generateResetPendingToken(staffId: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return signJWT<ResetPendingPayload>({
    sub:  staffId,
    type: "reset-pending",
    iat:  now,
    exp:  now + RESET_PENDING_TTL,
  });
}

export async function verifyResetPendingToken(token: string): Promise<ResetPendingPayload> {
  const payload = await decodeAndVerifyJWT<ResetPendingPayload>(token);
  if (payload.type !== "reset-pending") throw new Error("Not a reset pending token");
  return payload;
}

// ---------------------------------------------------------------------------
// generateRefreshToken
// ---------------------------------------------------------------------------

export async function generateRefreshToken(staffId: string, jti: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return signJWT<RefreshTokenPayload>({
    sub:  staffId,
    jti,
    type: "refresh",
    iat:  now,
    exp:  now + REFRESH_TTL,
  });
}

// ---------------------------------------------------------------------------
// verifyAccessToken
// ---------------------------------------------------------------------------

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const payload = await decodeAndVerifyJWT<AccessTokenPayload>(token);
  if (payload.type !== "access") throw new Error("Not an access token");
  return payload;
}

// ---------------------------------------------------------------------------
// verifyRefreshToken
// ---------------------------------------------------------------------------

export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
  const payload = await decodeAndVerifyJWT<RefreshTokenPayload>(token);
  if (payload.type !== "refresh") throw new Error("Not a refresh token");
  return payload;
}

// ---------------------------------------------------------------------------
// Cookie helpers — server-only (use only in Route Handlers / Server Actions)
// ---------------------------------------------------------------------------

export async function setRefreshCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    path:     "/",
    maxAge:   REFRESH_TTL,
  });
}

export async function getRefreshCookie(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(REFRESH_COOKIE)?.value ?? null;
}

export async function clearRefreshCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(REFRESH_COOKIE);
}

// ---------------------------------------------------------------------------
// extractBearerToken — helper for route handlers
// ---------------------------------------------------------------------------

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}
