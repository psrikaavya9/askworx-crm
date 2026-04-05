import type {
  Staff,
  Attendance,
  FieldVisit,
  StaffRole,
  StaffStatus,
  AttendanceStatus,
  ValidationStatus,
  FieldVisitStatus,
} from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Re-export Prisma-generated types
// ---------------------------------------------------------------------------

export type {
  Staff,
  Attendance,
  FieldVisit,
  StaffRole,
  StaffStatus,
  AttendanceStatus,
  ValidationStatus,
  FieldVisitStatus,
};

// ---------------------------------------------------------------------------
// Enriched types
// ---------------------------------------------------------------------------

export type StaffWithAttendance = Staff & {
  attendances: Attendance[];
};

export type AttendanceWithStaff = Attendance & {
  staff: Pick<Staff, "id" | "firstName" | "lastName" | "email" | "department" | "role">;
};

// Used on the attendance dashboard — every active staff member + today's record (may be null)
export interface TodayAttendanceRow {
  staff: Pick<Staff, "id" | "firstName" | "lastName" | "department" | "role">;
  attendance: Attendance | null;
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  OWNER:       "Owner",
  SUPER_ADMIN: "Super Admin",
  ADMIN:       "Admin",
  MANAGER:     "Manager",
  STAFF:       "Staff",
};

export const STAFF_STATUS_LABELS: Record<StaffStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
};

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  // ── Final 8 statuses ────────────────────────────────────────────────────
  FULL_DAY:    "Full Day",
  HALF_DAY:    "Half Day",
  LATE:        "Late",
  EARLY_EXIT:  "Early Exit",
  ABSENT:      "Absent",
  ON_LEAVE:    "On Leave",
  FIELD_VISIT: "Field Visit",
  WFH:         "WFH",
  // ── Interim (check-in recorded, checkout pending) ────────────────────────
  PRESENT:      "Present",
  // ── Legacy enum value — no longer emitted ───────────────────────────────
  LATE_ARRIVAL: "Late",   // maps to same label as LATE
};

// ---------------------------------------------------------------------------
// FieldVisit enriched types
// ---------------------------------------------------------------------------

export type FieldVisitWithStaff = FieldVisit & {
  staff: Pick<Staff, "firstName" | "lastName" | "department">;
};

// ---------------------------------------------------------------------------
// KPI types
// ---------------------------------------------------------------------------

export interface AttendanceKPI {
  totalStaff: number;
  presentToday: number;
  absentToday: number;
  lateToday: number;
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
