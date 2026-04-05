import { NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Lightweight JWT signer using Web Crypto (no extra dependencies)
// ---------------------------------------------------------------------------

function b64url(data: string): string {
  return Buffer.from(data, "utf8").toString("base64url");
}

async function signJWT(
  payload: Record<string, unknown>,
  secret: string
): Promise<string> {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body   = b64url(JSON.stringify(payload));
  const input  = `${header}.${body}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(input)
  );

  return `${input}.${Buffer.from(sig).toString("base64url")}`;
}

// ---------------------------------------------------------------------------
// GET /api/vault/token
//
// Dev-mode: issues a signed JWT so the frontend can call the vault-server.
// In production: validate the user session before issuing.
// ---------------------------------------------------------------------------

export async function GET() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "JWT_SECRET not configured" },
      { status: 500 }
    );
  }

  const now = Math.floor(Date.now() / 1000);

  // For testing different users: set VAULT_TEST_SUB / VAULT_TEST_ROLE / VAULT_TEST_EMAIL
  // in Next.js .env.local, then restart the dev server.
  // Defaults to admin-001 ADMIN for normal usage.
  const token = await signJWT(
    {
      sub:   process.env.VAULT_TEST_SUB   ?? "admin-001",
      email: process.env.VAULT_TEST_EMAIL ?? "admin@askworx.com",
      role:  process.env.VAULT_TEST_ROLE  ?? "ADMIN",
      iat:   now,
      exp:   now + 7 * 24 * 3600,   // 7 days
    },
    secret
  );

  return NextResponse.json({ token });
}
