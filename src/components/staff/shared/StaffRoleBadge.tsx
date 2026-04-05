import { Badge } from "@/components/ui/Badge";
import type { StaffRole } from "@/modules/staff/types";
import { STAFF_ROLE_LABELS } from "@/modules/staff/types";

const ROLE_VARIANT: Record<StaffRole, "indigo" | "blue" | "gray" | "purple" | "orange"> = {
  OWNER:       "orange",
  SUPER_ADMIN: "purple",
  ADMIN:       "indigo",
  MANAGER:     "blue",
  STAFF:       "gray",
};

export function StaffRoleBadge({ role }: { role: StaffRole }) {
  return <Badge variant={ROLE_VARIANT[role]}>{STAFF_ROLE_LABELS[role]}</Badge>;
}
