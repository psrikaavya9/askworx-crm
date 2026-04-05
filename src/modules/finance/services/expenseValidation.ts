/**
 * expenseValidation.ts — Layer 1: Attendance Validation
 *
 * Determines whether a staff member has a valid attendance basis for a
 * given expense date.  This is the first gate in the expense submission
 * pipeline; future validation layers (GPS, receipt, approval) will be
 * added to this same file.
 *
 * Decision tree
 * ─────────────────────────────────────────────────────────────────────────────
 *  1.  No Attendance record for the date
 *        → Check FieldVisit fallback (visit may pre-date attendance creation)
 *        → If no approved/active visit either → REJECT
 *
 *  2.  attendanceStatus === ABSENT
 *        → REJECT immediately — no partial passes for absent days
 *
 *  3.  attendanceStatus is a "present" variant
 *        (PRESENT | LATE | FULL_DAY | HALF_DAY | EARLY_EXIT | WFH | LATE_ARRIVAL)
 *        → PASS — staff was physically or remotely present
 *
 *  4.  attendanceStatus === ON_LEAVE
 *        → PASS — this status is only set when an approved leave record exists
 *
 *  5.  attendanceStatus === FIELD_VISIT
 *        → Verify a FieldVisit row for this date with a productive status
 *          (APPROVED | IN_PROGRESS | COMPLETED) exists
 *        → Found  → PASS
 *        → Not found → REJECT
 *
 *  6.  Any other / unexpected status
 *        → REJECT (fail-safe)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Timezone
 *   All date comparisons use midnight UTC (same convention as the Attendance
 *   model's @@unique([staffId, date]) constraint).  The caller passes a plain
 *   Date object; this module normalises it internally so the caller never needs
 *   to worry about timezone offset.
 */

import { prisma } from "@/lib/prisma";
import type { AttendanceStatus, FieldVisitStatus } from "@/generated/prisma/client";
import { haversineMeters } from "@/lib/geo";

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export type AttendanceValidationResult =
  | { valid: true }
  | { valid: false; reason: string };

// ---------------------------------------------------------------------------
// Status sets
// ---------------------------------------------------------------------------

/**
 * Attendance statuses that unambiguously confirm the staff member was working
 * that day (on-site, remote, late, or otherwise present).
 */
const PRESENT_STATUSES = new Set<AttendanceStatus>([
  "PRESENT",
  "LATE",
  "FULL_DAY",
  "HALF_DAY",
  "EARLY_EXIT",
  "WFH",
  "LATE_ARRIVAL",   // deprecated but still in DB; treat as present
]);

/**
 * FieldVisit statuses that confirm the staff member was actively on a visit.
 * PENDING is excluded — a pending visit has not yet been authorised.
 * REJECTED is excluded — the visit was not approved.
 */
const ACTIVE_VISIT_STATUSES = new Set<FieldVisitStatus>([
  "APPROVED",
  "IN_PROGRESS",
  "COMPLETED",
]);

// ---------------------------------------------------------------------------
// Date helper (mirrors attendance.repository.toDateOnly)
// ---------------------------------------------------------------------------

/** Normalise any Date to midnight UTC — matches the Attendance table's storage convention. */
function toDateOnly(d: Date): Date {
  const out = new Date(d);
  out.setUTCHours(0, 0, 0, 0);
  return out;
}

// ---------------------------------------------------------------------------
// Field-visit fallback query
// ---------------------------------------------------------------------------

/**
 * Returns true when the staff member has an active/approved FieldVisit on the
 * given date.  Used both as a primary check for FIELD_VISIT attendance status
 * and as a fallback when no Attendance row exists at all.
 */
async function hasActiveFieldVisit(staffId: string, date: Date): Promise<boolean> {
  const visit = await prisma.fieldVisit.findFirst({
    where: {
      staffId,
      date:   toDateOnly(date),
      status: { in: [...ACTIVE_VISIT_STATUSES] },
    },
    select: { id: true },   // minimal projection — we only need existence
  });
  return visit !== null;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Validate that `staffId` has a legitimate attendance basis for `expenseDate`.
 *
 * @param staffId     Staff.id (from JWT — never trust the request body)
 * @param expenseDate The date the expense was incurred (any timezone is fine;
 *                    the function normalises to midnight UTC internally)
 *
 * @returns `{ valid: true }` on success, or
 *          `{ valid: false, reason: "<human-readable message>" }` on failure.
 */
export async function validateAttendance(
  staffId:     string,
  expenseDate: Date,
): Promise<AttendanceValidationResult> {

  const dateKey = toDateOnly(expenseDate);

  // ── Guard: reject future-dated expenses at this layer ───────────────────
  // (The form already blocks this via max={TODAY}, but the API must not trust
  //  client-side constraints.)
  const todayKey = toDateOnly(new Date());
  if (dateKey > todayKey) {
    return { valid: false, reason: "Expense date cannot be in the future" };
  }

  // ── Step 1: Look up Attendance using the unique composite index ───────────
  const attendance = await prisma.attendance.findUnique({
    where:  { staffId_date: { staffId, date: dateKey } },
    select: { attendanceStatus: true },
  });

  // ── Step 1b: No Attendance row — field-visit fallback ────────────────────
  if (!attendance) {
    const onVisit = await hasActiveFieldVisit(staffId, expenseDate);
    if (onVisit) return { valid: true };
    return {
      valid:  false,
      reason: "No attendance record found for this date",
    };
  }

  const status = attendance.attendanceStatus;

  // ── Step 2: Absent — hard reject ─────────────────────────────────────────
  if (status === "ABSENT") {
    return { valid: false, reason: "You were marked absent on this date" };
  }

  // ── Step 3: Present variants — immediate pass ─────────────────────────────
  if (PRESENT_STATUSES.has(status)) {
    return { valid: true };
  }

  // ── Step 4: Approved leave — pass (status is only set after approval) ─────
  if (status === "ON_LEAVE") {
    return { valid: true };
  }

  // ── Step 5: Field visit — verify against FieldVisit table ─────────────────
  if (status === "FIELD_VISIT") {
    const onVisit = await hasActiveFieldVisit(staffId, expenseDate);
    if (onVisit) return { valid: true };
    return {
      valid:  false,
      reason: "Field visit on this date could not be verified or has not been approved",
    };
  }

  // ── Step 6: Unknown / future status values — fail-safe reject ─────────────
  return {
    valid:  false,
    reason: "No valid attendance or approved activity found for this date",
  };
}

// ---------------------------------------------------------------------------
// Layer 2: GPS Validation
// ---------------------------------------------------------------------------

/** Thresholds (metres) */
const OFFICE_RADIUS_M  = 5_000;  // 5 km
const CLIENT_RADIUS_M  =   500;  // 500 m

export type GpsValidationResult =
  | { isFlagged: false }
  | { isFlagged: true; flagReason: string };

export interface GpsValidationInput {
  gpsLat?:   number;
  gpsLng?:   number;
  clientId?: string;
}

/**
 * Validate GPS coordinates against an expected location.
 *
 * Decision tree
 * ─────────────────────────────────────────────────────────────────────────────
 *  1.  No GPS provided → PASS (GPS capture is opt-in on the form)
 *
 *  2.  clientId provided AND the Client row has lat/lng
 *        → Check within CLIENT_RADIUS_M of client location
 *        → Out of range → FLAG with distance in reason
 *        → In range     → PASS
 *
 *  3.  Otherwise → Check within OFFICE_RADIUS_M of office location
 *        (office coords come from OFFICE_LAT / OFFICE_LNG env vars)
 *        → Env vars missing → PASS (GPS check not configured; don't block)
 *        → Out of range     → FLAG with distance in reason
 *        → In range         → PASS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * GPS mismatches are NEVER hard-rejections — they set isFlagged for manual review.
 *
 * @returns `{ isFlagged: false }` on pass, or
 *          `{ isFlagged: true, flagReason: "..." }` on mismatch.
 */
export async function validateGPS(
  input: GpsValidationInput,
): Promise<GpsValidationResult> {

  const { gpsLat, gpsLng, clientId } = input;

  // ── 1. GPS not captured — skip silently ────────────────────────────────────
  if (gpsLat === undefined || gpsLng === undefined) {
    return { isFlagged: false };
  }

  // ── 2. Client-site check ────────────────────────────────────────────────────
  if (clientId) {
    const client = await prisma.client.findUnique({
      where:  { id: clientId },
      select: { lat: true, lng: true, company: true },
    });

    if (client?.lat !== null && client?.lat !== undefined &&
        client?.lng !== null && client?.lng !== undefined) {
      const dist = haversineMeters(gpsLat, gpsLng, client.lat, client.lng);
      if (dist > CLIENT_RADIUS_M) {
        return {
          isFlagged: true,
          flagReason: `GPS is ${Math.round(dist)}m from client "${client.company}" (limit ${CLIENT_RADIUS_M}m)`,
        };
      }
      return { isFlagged: false };
    }
    // Client has no geo data — fall through to office check
  }

  // ── 3. Office check ────────────────────────────────────────────────────────
  const officeLat = parseFloat(process.env.OFFICE_LAT ?? "");
  const officeLng = parseFloat(process.env.OFFICE_LNG ?? "");

  if (isNaN(officeLat) || isNaN(officeLng)) {
    // Office coordinates not configured — pass without flagging
    return { isFlagged: false };
  }

  const dist = haversineMeters(gpsLat, gpsLng, officeLat, officeLng);
  if (dist > OFFICE_RADIUS_M) {
    return {
      isFlagged: true,
      flagReason: `GPS is ${Math.round(dist)}m from office (limit ${OFFICE_RADIUS_M}m)`,
    };
  }

  return { isFlagged: false };
}

// ---------------------------------------------------------------------------
// Layer 3: Receipt Validation
// ---------------------------------------------------------------------------

/**
 * Result union for receipt validation.
 *
 * Three outcomes:
 *   • REJECT  — { valid: false, reason }
 *   • FLAG    — { valid: true, flagged: true, reason }
 *   • PASS    — { valid: true }
 */
export type ReceiptValidationResult =
  | { valid: false; reason: string }
  | { valid: true; flagged: true; reason: string }
  | { valid: true; flagged?: false };

export interface ReceiptValidationInput {
  staffId:     string;
  amount:      number;          // already normalised to a JS number by the caller
  description: string | null | undefined;
  receiptUrl:  string | null | undefined;
  date:        Date;            // expense date — used for pre-approval date match
}

// Amount tier boundaries (₹)
const TIER_FLAG_LOW  =  200;   // 200 – 499
const TIER_REJECT    =  500;   // 500 – 1999
const TIER_HIGH      = 2000;   // 2000 – 4999
const TIER_PREAPPROVAL = 5000; // ≥ 5000

/** True when receiptUrl is a non-empty string. */
function hasReceipt(url: string | null | undefined): boolean {
  return typeof url === "string" && url.trim().length > 0;
}

/**
 * True when the description is present and at least 10 non-whitespace
 * characters long — a deliberately low bar that weeds out placeholder values
 * ("expense", "misc", etc.) without being overly restrictive.
 */
function hasStrongDescription(desc: string | null | undefined): boolean {
  if (!desc) return false;
  return desc.trim().length >= 10;
}

/**
 * Returns the first APPROVED pre-approval for the staff member that covers
 * the given expense date.  Amount is not checked server-side — the pre-approval
 * authorises the staff member for that date, not a specific amount.
 */
async function findApprovedPreApproval(
  staffId: string,
  expenseDate: Date,
): Promise<boolean> {
  const dateKey = toDateOnly(expenseDate);

  const row = await prisma.preApproval.findFirst({
    where: {
      staffId,
      status:    "APPROVED",
      validDate: dateKey,
    },
    select: { id: true },
  });

  return row !== null;
}

/**
 * Validate an expense submission based on amount, receipt presence, and
 * pre-approval status.
 *
 * Amount tiers
 * ─────────────────────────────────────────────────────────────────────────────
 *  < 200        → PASS   (no receipt required)
 *  200 – 499    → PASS   (receipt optional; FLAG if missing)
 *  500 – 1999   → PASS   (receipt required; REJECT if missing)
 *  2000 – 4999  → PASS   (receipt required; REJECT if missing;
 *                          FLAG if description is weak)
 *  ≥ 5000       → PASS   (pre-approval required; receipt required)
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function validateReceipt(
  input: ReceiptValidationInput,
): Promise<ReceiptValidationResult> {

  const { staffId, amount, description, receiptUrl, date } = input;
  const receipt = hasReceipt(receiptUrl);

  // ── Tier 1: amount < ₹200 — no requirements ────────────────────────────────
  if (amount < TIER_FLAG_LOW) {
    return { valid: true };
  }

  // ── Tier 2: ₹200 – ₹499 — receipt optional; flag if missing ───────────────
  if (amount < TIER_REJECT) {
    if (!receipt) {
      return { valid: true, flagged: true, reason: "Receipt missing (optional range)" };
    }
    return { valid: true };
  }

  // ── Tier 3: ₹500 – ₹1999 — receipt required ────────────────────────────────
  if (amount < TIER_HIGH) {
    if (!receipt) {
      return { valid: false, reason: "Receipt required above ₹500" };
    }
    return { valid: true };
  }

  // ── Tier 4: ₹2000 – ₹4999 — receipt required + strong description ──────────
  if (amount < TIER_PREAPPROVAL) {
    if (!receipt) {
      return { valid: false, reason: "Receipt required above ₹500" };
    }
    if (!hasStrongDescription(description)) {
      return {
        valid:   true,
        flagged: true,
        reason:  "Description does not clearly match expense",
      };
    }
    return { valid: true };
  }

  // ── Tier 5: ≥ ₹5000 — pre-approval + receipt required ─────────────────────
  const preApproved = await findApprovedPreApproval(staffId, date);
  if (!preApproved) {
    return { valid: false, reason: "Pre-approval required for expenses above ₹5000" };
  }
  if (!receipt) {
    return { valid: false, reason: "Receipt required above ₹500" };
  }
  return { valid: true };
}
