import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StaffRole = "ADMIN" | "MANAGER" | "STAFF";
export type VaultAccessLevel = "ALL" | "MANAGER_ONLY" | "HR_ONLY" | "CUSTOM";

export interface JwtPayload {
  sub:   string;
  email: string;
  role:  StaffRole;
  iat?:  number;
  exp?:  number;
}

const ROLE_RANK: Record<StaffRole, number> = {
  ADMIN:   3,
  MANAGER: 2,
  STAFF:   1,
};

// ---------------------------------------------------------------------------
// JWT verification using Web Crypto (no extra dependencies)
// ---------------------------------------------------------------------------

export async function verifyJWT(token: string): Promise<JwtPayload> {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw createVaultError("JWT_SECRET not configured", 500);

  const parts = token.split(".");
  if (parts.length !== 3) throw createVaultError("Invalid token format", 401);

  const [header, payload, signature] = parts;
  const data = `${header}.${payload}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const sigBytes = Buffer.from(signature, "base64url");
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes,
    new TextEncoder().encode(data)
  );

  if (!valid) throw createVaultError("Invalid token signature", 401);

  let decoded: JwtPayload;
  try {
    decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as JwtPayload;
  } catch {
    throw createVaultError("Malformed token payload", 401);
  }

  if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
    throw createVaultError("Token has expired", 401);
  }

  return decoded;
}

// ---------------------------------------------------------------------------
// Dev fallback user (used when JWT_SECRET is absent or token is missing in dev)
// ---------------------------------------------------------------------------

function getDevUser(): JwtPayload {
  return {
    sub:   process.env.VAULT_TEST_SUB   ?? "admin-001",
    email: process.env.VAULT_TEST_EMAIL ?? "admin@askworx.com",
    role:  (process.env.VAULT_TEST_ROLE ?? "ADMIN") as StaffRole,
  };
}

// ---------------------------------------------------------------------------
// Extract user from Authorization: Bearer <token> header
// ---------------------------------------------------------------------------

export async function getUserFromRequest(req: NextRequest): Promise<JwtPayload> {
  const authHeader = req.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    if (process.env.NODE_ENV !== "production") return getDevUser();
    throw createVaultError("Missing or malformed Authorization header", 401);
  }

  const token = authHeader.slice(7);
  try {
    return await verifyJWT(token);
  } catch (err) {
    if (process.env.NODE_ENV !== "production") return getDevUser();
    throw err;
  }
}

// ---------------------------------------------------------------------------
// withAuth — wraps a route handler with auth + optional RBAC
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteContext = { params: Promise<any> };

type AuthedHandler = (
  req: NextRequest,
  user: JwtPayload,
  ctx?: RouteContext
) => Promise<NextResponse>;

export function withAuth(handler: AuthedHandler, minimumRole?: StaffRole) {
  return async (req: NextRequest, ctx: RouteContext): Promise<NextResponse> => {
    let user: JwtPayload;
    try {
      user = await getUserFromRequest(req);
    } catch (err) {
      const e = err as VaultError;
      return NextResponse.json(
        { success: false, error: e.message },
        { status: e.statusCode ?? 401 }
      );
    }

    if (minimumRole && ROLE_RANK[user.role] < ROLE_RANK[minimumRole]) {
      return NextResponse.json(
        { success: false, error: `Requires "${minimumRole}" role or higher` },
        { status: 403 }
      );
    }

    try {
      return await handler(req, user, ctx);
    } catch (err) {
      const e = err as VaultError;
      const status  = e.statusCode ?? 500;
      const message = e.message    ?? "Internal server error";
      if (status >= 500) console.error("[vault-api]", message, err);
      return NextResponse.json({ success: false, error: message }, { status });
    }
  };
}

// ---------------------------------------------------------------------------
// RBAC resource-level check
// ---------------------------------------------------------------------------

export function canAccessVaultResource(
  user:         { sub: string; role: StaffRole },
  accessLevel:  VaultAccessLevel,
  allowedRoles: string[],
  allowedStaff: string[]
): boolean {
  switch (accessLevel) {
    case "ALL":         return true;
    case "MANAGER_ONLY": return ROLE_RANK[user.role] >= ROLE_RANK["MANAGER"];
    case "HR_ONLY":     return user.role === "ADMIN";
    case "CUSTOM":
      return allowedStaff.includes(user.sub) || allowedRoles.includes(user.role);
    default:            return false;
  }
}

// ---------------------------------------------------------------------------
// Error factory — carries HTTP status code
// ---------------------------------------------------------------------------

export interface VaultError extends Error {
  statusCode: number;
}

export function createVaultError(message: string, statusCode = 500): VaultError {
  const err = new Error(message) as VaultError;
  err.statusCode = statusCode;
  return err;
}
