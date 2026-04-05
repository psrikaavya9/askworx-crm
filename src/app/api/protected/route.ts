import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/authMiddleware";
import { withRole, roleCheck } from "@/lib/middleware/roleCheck";

// ---------------------------------------------------------------------------
// GET /api/protected
// Any authenticated user — returns verified identity from the JWT + DB.
// 401 if no/invalid token, 403 if account locked/inactive.
// ---------------------------------------------------------------------------
export const GET = withAuth(async (_req, user) =>
  NextResponse.json({
    success: true,
    message: "Token valid. You are authenticated.",
    user: {
      id:        user.sub,
      email:     user.email,
      firstName: user.firstName,
      lastName:  user.lastName,
      role:      user.role,   // always the fresh DB value, never stale JWT role
    },
    tokenMeta: {
      jti:       user.jti,
      issuedAt:  user.iat ? new Date(user.iat  * 1000).toISOString() : null,
      expiresAt: user.exp ? new Date(user.exp  * 1000).toISOString() : null,
    },
  })
);

// ---------------------------------------------------------------------------
// POST /api/protected
// Demonstrates minimum-rank gating: MANAGER and above only.
// 403 if role is STAFF.
// ---------------------------------------------------------------------------
export const POST = withRole("MANAGER", async (_req, user) =>
  NextResponse.json({
    success: true,
    message: "MANAGER-level access granted (MANAGER, ADMIN, SUPER_ADMIN, OWNER).",
    user:    { id: user.sub, role: user.role },
  })
);

// ---------------------------------------------------------------------------
// PATCH /api/protected
// Demonstrates minimum-rank gating: ADMIN and above only.
// ---------------------------------------------------------------------------
export const PATCH = withRole("ADMIN", async (_req, user) =>
  NextResponse.json({
    success: true,
    message: "ADMIN-level access granted (ADMIN, SUPER_ADMIN, OWNER).",
    user:    { id: user.sub, role: user.role },
  })
);

// ---------------------------------------------------------------------------
// DELETE /api/protected
// Demonstrates exact-role gating: OWNER only (not SUPER_ADMIN, not ADMIN).
// Uses withAuth + roleCheck(["OWNER"]) pattern for exact-list matching.
// ---------------------------------------------------------------------------
export const DELETE = withAuth(
  roleCheck(["OWNER"])(async (_req: NextRequest, user) =>
    NextResponse.json({
      success: true,
      message: "OWNER-only access granted.",
      user:    { id: user.sub, role: user.role },
    })
  )
);
