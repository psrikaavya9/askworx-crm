// ---------------------------------------------------------------------------
// rbac.ts — Role hierarchy, permission checks, DB row-level security simulation
// ---------------------------------------------------------------------------

import { StaffRole } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Role rank (higher = more permissions)
// ---------------------------------------------------------------------------

export const ROLE_RANK: Record<StaffRole, number> = {
  OWNER:       5,
  SUPER_ADMIN: 4,
  ADMIN:       3,
  MANAGER:     2,
  STAFF:       1,
};

export function hasMinimumRole(
  userRole: StaffRole,
  minimumRole: StaffRole
): boolean {
  return ROLE_RANK[userRole] >= ROLE_RANK[minimumRole];
}

// ---------------------------------------------------------------------------
// Row-level security simulation
// ---------------------------------------------------------------------------

/**
 * Builds a Prisma `where` filter that restricts data access based on role.
 * OWNER/SUPER_ADMIN/ADMIN see everything.
 * MANAGER sees their department's data if departmentField is provided.
 * STAFF sees only their own records (filtered by staffId field name).
 */
export function buildStaffFilter(
  userRole: StaffRole,
  userId: string,
  opts: {
    staffIdField?: string;    // e.g. "staffId" or "assignedToId"
    department?: string;
    departmentField?: string; // e.g. "department"
  } = {}
): Record<string, unknown> {
  if (ROLE_RANK[userRole] >= ROLE_RANK["ADMIN"]) {
    return {}; // No filter — sees all
  }

  if (userRole === "MANAGER" && opts.department && opts.departmentField) {
    return { [opts.departmentField]: opts.department };
  }

  // STAFF — own records only
  const field = opts.staffIdField ?? "staffId";
  return { [field]: userId };
}

// ---------------------------------------------------------------------------
// Resource-level access check
// ---------------------------------------------------------------------------

/**
 * Returns true if the user can access a resource owned by `ownerId`.
 * Admins+ can access anything. Others can only access their own.
 */
export function canAccessResource(
  userRole: StaffRole,
  userId: string,
  ownerId: string
): boolean {
  if (ROLE_RANK[userRole] >= ROLE_RANK["ADMIN"]) return true;
  return userId === ownerId;
}
