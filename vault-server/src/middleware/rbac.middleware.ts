import { Response, NextFunction } from "express";
import { AuthRequest, StaffRole, VaultAccessLevel } from "../types";
import { sendForbidden } from "../utils/response.util";

// ---------------------------------------------------------------------------
// Role hierarchy: ADMIN > MANAGER > STAFF
// ---------------------------------------------------------------------------

const ROLE_RANK: Record<StaffRole, number> = {
  ADMIN:   3,
  MANAGER: 2,
  STAFF:   1,
};

/**
 * requireRole(minimumRole)
 * Blocks requests from users whose role rank is below the minimum.
 *
 * Usage:  router.post("/...", authenticate, requireRole("MANAGER"), controller)
 */
export function requireRole(minimum: StaffRole) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const userRole = req.user?.role;
    if (!userRole) {
      sendForbidden(res, "Role information missing from token");
      return;
    }

    if (ROLE_RANK[userRole] >= ROLE_RANK[minimum]) {
      next();
    } else {
      sendForbidden(
        res,
        `Access denied. Requires "${minimum}" role or higher.`
      );
    }
  };
}

/**
 * canAccessVaultResource(accessLevel, allowedRoles, allowedStaff)
 * Runtime check — used inside service/controller after fetching the resource.
 *
 * Rules:
 *  ALL           → any authenticated staff
 *  MANAGER_ONLY  → MANAGER or ADMIN
 *  HR_ONLY       → ADMIN only (HR role maps to ADMIN in this schema)
 *  CUSTOM        → staffId in allowedStaff OR role in allowedRoles
 */
export function canAccessVaultResource(
  user: { sub: string; role: StaffRole },
  accessLevel: VaultAccessLevel,
  allowedRoles: string[],
  allowedStaff: string[]
): boolean {
  switch (accessLevel) {
    case "ALL":
      return true;

    case "MANAGER_ONLY":
      return ROLE_RANK[user.role] >= ROLE_RANK["MANAGER"];

    case "HR_ONLY":
      return user.role === "ADMIN";

    case "CUSTOM":
      return (
        allowedStaff.includes(user.sub) ||
        allowedRoles.includes(user.role)
      );

    default:
      return false;
  }
}

/**
 * requireAdmin — shorthand for requireRole("ADMIN")
 */
export const requireAdmin   = requireRole("ADMIN");

/**
 * requireManager — shorthand for requireRole("MANAGER")
 */
export const requireManager = requireRole("MANAGER");
