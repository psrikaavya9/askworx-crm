import { Badge } from "@/components/ui/Badge";
import type { AttendanceStatus } from "@/modules/staff/types";
import { ATTENDANCE_STATUS_LABELS } from "@/modules/staff/types";

const STATUS_VARIANT: Record<AttendanceStatus, "green" | "red" | "yellow"> = {
  // ── Final 8 statuses ────────────────────────────────────────────────────
  FULL_DAY:    "green",
  HALF_DAY:    "yellow",
  LATE:        "yellow",
  EARLY_EXIT:  "yellow",
  ABSENT:      "red",
  ON_LEAVE:    "yellow",
  FIELD_VISIT: "green",
  WFH:         "green",
  // ── Interim ─────────────────────────────────────────────────────────────
  PRESENT:      "green",
  // ── Legacy — no longer emitted ──────────────────────────────────────────
  LATE_ARRIVAL: "yellow",
};

export function AttendanceStatusBadge({ status }: { status: AttendanceStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{ATTENDANCE_STATUS_LABELS[status]}</Badge>;
}
