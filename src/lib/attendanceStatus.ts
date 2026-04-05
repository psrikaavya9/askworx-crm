/**
 * Pure attendance status engine — no DB access, no side effects.
 *
 * Final statuses (stored in attendanceStatus column):
 *   FULL_DAY | HALF_DAY | LATE | EARLY_EXIT | ABSENT | ON_LEAVE | FIELD_VISIT | WFH
 *
 * Priority order (highest wins):
 *   ON_LEAVE > WFH > FIELD_VISIT > FULL_DAY > HALF_DAY > LATE > EARLY_EXIT > ABSENT
 */

// ---------------------------------------------------------------------------
// Thresholds (all UTC)
// ---------------------------------------------------------------------------

export const LATE_HOUR         = 9;
export const LATE_MINUTE       = 30;  // check-in after 09:30 → late
export const EARLY_EXIT_HOUR   = 17;
export const EARLY_EXIT_MINUTE = 30;  // checkout before 17:30 → early exit
export const HALF_DAY_CHECKIN_HOUR = 13; // check-in at/after 13:00 → at best HALF_DAY
export const ABSENT_BY_HOUR    = 12;  // no check-in by 12:00 → ABSENT
export const FULL_DAY_HOURS    = 8;   // ≥8h required for FULL_DAY
export const HALF_DAY_MIN      = 4;   // ≥4h required for HALF_DAY (with hours criterion)

// ---------------------------------------------------------------------------
// Input / output types
// ---------------------------------------------------------------------------

export interface AttendanceStatusInput {
  checkInTime:   Date | null;
  checkOutTime:  Date | null;
  /** Decimal hours worked (e.g. 7.5). Pass 0 / null when checkout not yet recorded. */
  totalHours:    number;
  /** check-in after LATE_HOUR:LATE_MINUTE UTC */
  isLate:        boolean;
  /** checkout before EARLY_EXIT_HOUR:EARLY_EXIT_MINUTE UTC */
  isEarlyExit:   boolean;
  /** staff has an active/approved field visit for this date */
  hasFieldVisit: boolean;
  /** staff declared WFH for this day */
  isWFH:         boolean;
  /** approved leave record exists for this day */
  isOnLeave:     boolean;
}

/** The 8 final attendance statuses stored in the DB after checkout / EOD batch. */
export type RichAttendanceStatus =
  | "FULL_DAY"
  | "HALF_DAY"
  | "LATE"
  | "EARLY_EXIT"
  | "ABSENT"
  | "ON_LEAVE"
  | "FIELD_VISIT"
  | "WFH";

// ---------------------------------------------------------------------------
// Derived helpers (exported so callers can compute flags consistently)
// ---------------------------------------------------------------------------

/** True if checkInTime is after 09:30 UTC */
export function computeIsLate(checkInTime: Date): boolean {
  const h = checkInTime.getUTCHours();
  const m = checkInTime.getUTCMinutes();
  return h > LATE_HOUR || (h === LATE_HOUR && m >= LATE_MINUTE);
}

/** True if checkOutTime is before 17:30 UTC */
export function computeIsEarlyExit(checkOutTime: Date): boolean {
  const h = checkOutTime.getUTCHours();
  const m = checkOutTime.getUTCMinutes();
  return h < EARLY_EXIT_HOUR || (h === EARLY_EXIT_HOUR && m < EARLY_EXIT_MINUTE);
}

/** Decimal hours between two timestamps, rounded to 2dp */
export function computeTotalHours(checkInTime: Date, checkOutTime: Date): number {
  const ms = checkOutTime.getTime() - checkInTime.getTime();
  return Math.round((ms / (1000 * 60 * 60)) * 100) / 100;
}

/** True if no check-in by 12:00 UTC (used by end-of-day batch) */
export function isAbsentByNow(now: Date = new Date()): boolean {
  return now.getUTCHours() >= ABSENT_BY_HOUR;
}

// ---------------------------------------------------------------------------
// Core status resolver
// ---------------------------------------------------------------------------

/**
 * Compute the final rich attendance status from all available signals.
 * Call at checkout or during the end-of-day batch.
 */
export function getAttendanceStatus(input: AttendanceStatusInput): RichAttendanceStatus {
  const { checkInTime, checkOutTime, totalHours, isLate, isEarlyExit, hasFieldVisit, isWFH, isOnLeave } = input;

  // ── Priority 1: On Leave ────────────────────────────────────────────────
  if (isOnLeave) return "ON_LEAVE";

  // ── Priority 2: WFH ────────────────────────────────────────────────────
  if (isWFH) return "WFH";

  // ── Priority 3: Field Visit ─────────────────────────────────────────────
  if (hasFieldVisit) return "FIELD_VISIT";

  // ── No check-in → ABSENT ────────────────────────────────────────────────
  if (!checkInTime) return "ABSENT";

  // ── Priority 4: Full Day ─────────────────────────────────────────────────
  // Requires: ≥8h worked, checked in on time, not left early
  if (checkOutTime && totalHours >= FULL_DAY_HOURS && !isLate && !isEarlyExit) {
    return "FULL_DAY";
  }

  // ── Priority 5: Half Day ─────────────────────────────────────────────────
  // Either worked 4–7.9h at checkout, OR checked in after 1 PM
  const checkedInAfter1PM =
    checkInTime.getUTCHours() >= HALF_DAY_CHECKIN_HOUR;

  if (
    (checkOutTime && totalHours >= HALF_DAY_MIN && totalHours < FULL_DAY_HOURS) ||
    checkedInAfter1PM
  ) {
    return "HALF_DAY";
  }

  // ── Priority 6: Late ─────────────────────────────────────────────────────
  // Checked in between 09:30 and 11:59 UTC
  if (isLate && checkInTime.getUTCHours() < ABSENT_BY_HOUR) {
    return "LATE";
  }

  // ── Priority 7: Early Exit ────────────────────────────────────────────────
  if (checkOutTime && isEarlyExit) return "EARLY_EXIT";

  // ── Fallback: Absent (no qualifying record) ───────────────────────────────
  return "ABSENT";
}
