"use client";

import {
  createContext,
  useContext,
  ReactNode,
} from "react";
import { StaffRole } from "@/generated/prisma/client";
import { ROLE_RANK } from "@/lib/rbac";
import { useAuth } from "@/contexts/AuthContext";

// ---------------------------------------------------------------------------
// RoleContext — provides role-based UI gating
// ---------------------------------------------------------------------------

interface RoleContextValue {
  role:              StaffRole | null;
  hasRole:           (minimumRole: StaffRole) => boolean;
  isOwner:           boolean;
  isSuperAdmin:      boolean;
  isAdmin:           boolean;
  isManager:         boolean;
}

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const role = user?.role ?? null;

  const hasRole = (minimumRole: StaffRole): boolean => {
    if (!role) return false;
    return ROLE_RANK[role] >= ROLE_RANK[minimumRole];
  };

  const value: RoleContextValue = {
    role,
    hasRole,
    isOwner:      role === "OWNER",
    isSuperAdmin: role === "SUPER_ADMIN" || role === "OWNER",
    isAdmin:      hasRole("ADMIN"),
    isManager:    hasRole("MANAGER"),
  };

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within a RoleProvider");
  return ctx;
}

// ---------------------------------------------------------------------------
// RoleGate — conditionally renders children based on role
//
// Usage:
//   <RoleGate minimumRole="ADMIN">
//     <AdminPanel />
//   </RoleGate>
//
//   <RoleGate minimumRole="MANAGER" fallback={<p>No access</p>}>
//     <ManagerView />
//   </RoleGate>
// ---------------------------------------------------------------------------

interface RoleGateProps {
  minimumRole: StaffRole;
  children:    ReactNode;
  fallback?:   ReactNode;
}

export function RoleGate({ minimumRole, children, fallback = null }: RoleGateProps) {
  const { hasRole } = useRole();
  return hasRole(minimumRole) ? <>{children}</> : <>{fallback}</>;
}
