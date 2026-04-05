import { NextResponse } from "next/server";
import type { StaffRole } from "@/generated/prisma/client";
import { type AuthHandler, type RouteCtx, withAuth } from "@/lib/middleware/authMiddleware";

// ---------------------------------------------------------------------------
// Role hierarchy
// ---------------------------------------------------------------------------

export const ROLE_RANK: Record<StaffRole, number> = {
  OWNER:       5,
  SUPER_ADMIN: 4,
  ADMIN:       3,
  MANAGER:     2,
  STAFF:       1,
};

// ---------------------------------------------------------------------------
// roleCheck — composable role-gate decorator
//
// Takes an array of allowed roles and returns a function that wraps an
// AuthHandler.  Must be used INSIDE withAuth so that user.role is already
// the fresh DB value (zero-trust guarantee from withAuth).
//
// Supports two matching modes:
//   - Exact list:   roleCheck(["OWNER", "ADMIN"])
//                   → only OWNER or ADMIN pass; SUPER_ADMIN is rejected
//
//   - Minimum rank: roleCheck(["MANAGER"], { minimumRank: true })
//                   → MANAGER, ADMIN, SUPER_ADMIN, OWNER all pass
//
// Usage:
//   export const GET    = withAuth(roleCheck(["OWNER"])(handler));
//   export const POST   = withAuth(roleCheck(["ADMIN", "SUPER_ADMIN"])(handler));
//   export const DELETE = withAuth(roleCheck(["MANAGER"], { minimumRank: true })(handler));
// ---------------------------------------------------------------------------

interface RoleCheckOptions {
  /**
   * When true, the check becomes "user's rank >= lowest rank in allowedRoles"
   * instead of an exact membership test.
   * Default: false (exact list match).
   */
  minimumRank?: boolean;
}

export function roleCheck(
  allowedRoles: StaffRole[],
  { minimumRank = false }: RoleCheckOptions = {}
) {
  return function (handler: AuthHandler): AuthHandler {
    return async (req, user, ctx) => {
      const allowed = minimumRank
        ? ROLE_RANK[user.role] >= Math.min(...allowedRoles.map((r) => ROLE_RANK[r]))
        : allowedRoles.includes(user.role);

      if (!allowed) {
        return NextResponse.json(
          {
            success: false,
            error:   minimumRank
              ? `Requires at least "${allowedRoles[0]}" role`
              : `Access restricted to: ${allowedRoles.join(", ")}`,
            code:    "FORBIDDEN",
            requiredRoles: allowedRoles,
            yourRole:      user.role,
          },
          { status: 403 }
        );
      }

      return handler(req, user, ctx);
    };
  };
}

// ---------------------------------------------------------------------------
// withRole — convenience wrapper that fuses withAuth + roleCheck
//
// Equivalent to: withAuth(roleCheck([minimumRole], { minimumRank: true })(handler))
//
// Usage (minimum-rank style — most common):
//   export const GET    = withRole("STAFF",   handler);  // any authenticated user
//   export const POST   = withRole("MANAGER", handler);  // MANAGER and above
//   export const DELETE = withRole("ADMIN",   handler);  // ADMIN and above
//   export const PATCH  = withRole("OWNER",   handler);  // OWNER only
// ---------------------------------------------------------------------------

export function withRole(minimumRole: StaffRole, handler: AuthHandler) {
  return withAuth(roleCheck([minimumRole], { minimumRank: true })(handler));
}

// ---------------------------------------------------------------------------
// hasRole — inline runtime check for use inside a handler body
//
// Use this when a single route has branching logic that depends on role,
// rather than needing a whole separate route per role.
//
// Usage:
//   export const GET = withAuth(async (req, user) => {
//     const filter = hasRole(user.role, "ADMIN")
//       ? {}                      // admins see all records
//       : { staffId: user.sub };  // staff see only their own
//     const data = await prisma.expense.findMany({ where: filter });
//     return NextResponse.json({ data });
//   });
// ---------------------------------------------------------------------------

export function hasRole(userRole: StaffRole, minimumRole: StaffRole): boolean {
  return ROLE_RANK[userRole] >= ROLE_RANK[minimumRole];
}

// ---------------------------------------------------------------------------
// USAGE REFERENCE
// ---------------------------------------------------------------------------
//
// ── Pattern 1: withAuth only (any logged-in user) ──────────────────────────
//
//   import { withAuth } from "@/lib/middleware/authMiddleware";
//
//   export const GET = withAuth(async (req, user) => {
//     return NextResponse.json({ id: user.sub, role: user.role });
//   });
//
//
// ── Pattern 2: withRole (minimum rank — most common for simple gates) ───────
//
//   import { withRole } from "@/lib/middleware/roleCheck";
//
//   export const DELETE = withRole("ADMIN", async (req, user, ctx) => {
//     const { id } = await ctx!.params;
//     await prisma.lead.delete({ where: { id } });
//     return NextResponse.json({ success: true });
//   });
//
//
// ── Pattern 3: withAuth + roleCheck (exact role list) ──────────────────────
//
//   import { withAuth } from "@/lib/middleware/authMiddleware";
//   import { roleCheck } from "@/lib/middleware/roleCheck";
//
//   // Only OWNER — not SUPER_ADMIN, not ADMIN
//   export const POST = withAuth(
//     roleCheck(["OWNER"])(async (req, user) => {
//       return NextResponse.json({ message: "owner-only action" });
//     })
//   );
//
//   // Multiple specific roles
//   export const PATCH = withAuth(
//     roleCheck(["OWNER", "SUPER_ADMIN"])(async (req, user) => {
//       return NextResponse.json({ message: "owner or super_admin only" });
//     })
//   );
//
//
// ── Pattern 4: withAuth + roleCheck (minimum rank via option) ───────────────
//
//   // MANAGER and everyone above (ADMIN, SUPER_ADMIN, OWNER)
//   export const GET = withAuth(
//     roleCheck(["MANAGER"], { minimumRank: true })(async (req, user) => {
//       return NextResponse.json({ data: "manager+ data" });
//     })
//   );
//
//
// ── Pattern 5: hasRole inside a handler (branching logic) ──────────────────
//
//   import { withAuth } from "@/lib/middleware/authMiddleware";
//   import { hasRole }  from "@/lib/middleware/roleCheck";
//
//   export const GET = withAuth(async (req, user) => {
//     // Admins see all expenses; staff see only their own
//     const where = hasRole(user.role, "ADMIN")
//       ? {}
//       : { staffId: user.sub };
//     const expenses = await prisma.expense.findMany({ where });
//     return NextResponse.json({ success: true, data: expenses });
//   });
//
//
// ── Pattern 6: dynamic route with ctx ──────────────────────────────────────
//
//   import { withRole } from "@/lib/middleware/roleCheck";
//
//   type Ctx = { params: Promise<{ id: string }> };
//
//   export const DELETE = withRole("ADMIN", async (req, user, ctx?: Ctx) => {
//     const { id } = await ctx!.params;
//     await prisma.staff.delete({ where: { id } });
//     return NextResponse.json({ success: true });
//   });
//
// ---------------------------------------------------------------------------
