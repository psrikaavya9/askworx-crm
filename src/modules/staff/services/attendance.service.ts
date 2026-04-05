import * as attendanceRepo from "../repositories/attendance.repository";
import * as staffRepo from "../repositories/staff.repository";
import * as fieldVisitRepo from "../repositories/fieldvisit.repository";
import type { CheckInInput, CheckOutInput, AttendanceFiltersInput, QRCheckInInput } from "../schemas/attendance.schema";
import type { AttendanceKPI } from "../types";
import { validateQRContent } from "@/lib/qr-token";
import { saveSelfie } from "@/lib/saveSelfie";
import {
  getAttendanceStatus,
  computeIsLate,
  computeIsEarlyExit,
  computeTotalHours,
  isAbsentByNow,
} from "@/lib/attendanceStatus";

// ---------------------------------------------------------------------------
// Confidence score & validation status (Module 8)
//
// GPS captured  → +50
// Selfie present → +30
// QR scanned    → +20
// Max score       100
//
// VALID   ≥ 70   (two strong signals, e.g. GPS+Selfie or GPS+QR)
// FLAGGED 40–69  (one strong signal)
// REJECTED < 40  (no verifiable signal)
// ---------------------------------------------------------------------------

function computeConfidenceScore(hasGps: boolean, hasSelfie: boolean, hasQr = false): number {
  let score = 0;
  if (hasGps)    score += 50;
  if (hasSelfie) score += 30;
  if (hasQr)     score += 20;
  return score;
}

function getValidationStatus(score: number): "VALID" | "FLAGGED" | "REJECTED" {
  if (score >= 70) return "VALID";
  if (score >= 40) return "FLAGGED";
  return "REJECTED";
}

// ---------------------------------------------------------------------------
// Attendance service
// ---------------------------------------------------------------------------

export async function checkIn(data: CheckInInput) {
  // Verify staff exists
  const staff = await staffRepo.findStaffById(data.staffId);
  if (!staff) throw new Error(`Staff member not found: ${data.staffId}`);
  if (staff.status === "INACTIVE") throw new Error("Inactive staff cannot check in.");

  // Prevent duplicate check-in on same day
  const existing = await attendanceRepo.findAttendanceRecord(data.staffId, new Date());
  if (existing) throw new Error(`${staff.firstName} ${staff.lastName} has already checked in today.`);

  // ── Determine effective method ──────────────────────────────────────────
  // If the client explicitly declared SELFIE method, or attached a selfie
  // without declaring a method, treat this as a selfie-based check-in.
  const isSelfieMethod =
    data.method === "SELFIE" ||
    (data.method == null && !!data.selfie);

  const hasGps =
    (data.latitude != null && data.longitude != null) ||
    !!data.location;

  // ── Validation rules for SELFIE method ───────────────────────────────────
  // Both selfie and GPS are mandatory — a selfie without location cannot be
  // reliably verified as on-premises.
  if (isSelfieMethod) {
    if (!data.selfie) {
      throw new Error("Selfie is required for this check-in method.");
    }
    if (!hasGps) {
      throw new Error(
        "GPS location is required when checking in with a selfie. " +
        "Please enable location access and try again."
      );
    }
  }

  // ── Build the resolved payload ────────────────────────────────────────────
  const resolved: CheckInInput = { ...data };

  // 1. GPS — build "lat,lng" string from discrete fields if not already present
  if (data.latitude != null && data.longitude != null && !resolved.location) {
    resolved.location = `${data.latitude.toFixed(6)},${data.longitude.toFixed(6)}`;
  }

  // 2. Selfie — convert base64 → saved file and replace with public URL
  if (data.selfie) {
    try {
      resolved.selfie = await saveSelfie(data.selfie, data.staffId);
    } catch (saveErr) {
      console.error("[checkIn] saveSelfie failed, storing raw base64:", saveErr);
    }
  }

  // ── Optional QR validation ────────────────────────────────────────────────
  // A staff member may scan the office QR code during a GPS/selfie check-in to
  // boost their confidence score to 100. If qrContent is provided but invalid
  // we reject the request rather than silently downgrading.
  let resolvedHasQR = false;
  if (data.qrContent) {
    const { valid } = validateQRContent(data.qrContent);
    if (!valid) throw new Error("Invalid or expired QR code. Please scan today's QR code.");
    resolvedHasQR = true;
  }

  // ── Signal flags + confidence score ──────────────────────────────────────
  // Re-evaluate hasGps after resolution (location may have been built above).
  const resolvedHasGps    = !!resolved.location;
  const resolvedHasSelfie = !!resolved.selfie;
  const confidenceScore   = computeConfidenceScore(resolvedHasGps, resolvedHasSelfie, resolvedHasQR);
  const validationStatus  = getValidationStatus(confidenceScore);

  // Safety validation: at least one verification signal required
  if (!resolvedHasGps && !resolvedHasSelfie && !resolvedHasQR) {
    throw new Error(
      "Check-in requires at least one verification method. " +
      "Please enable GPS location, take a selfie, or scan the QR code."
    );
  }

  return attendanceRepo.createCheckIn(resolved, {
    method: isSelfieMethod ? "SELFIE" : (data.method ?? undefined),
    confidenceScore,
    validationStatus,
    hasGPS:    resolvedHasGps,
    hasSelfie: resolvedHasSelfie,
    hasQR:     resolvedHasQR,
  });
}

export async function checkOut(data: CheckOutInput) {
  const staff = await staffRepo.findStaffById(data.staffId);
  if (!staff) throw new Error(`Staff member not found: ${data.staffId}`);

  const record = await attendanceRepo.findAttendanceRecord(data.staffId, new Date());
  if (!record) throw new Error(`${staff.firstName} ${staff.lastName} has not checked in today.`);
  if (record.checkOutTime) throw new Error(`${staff.firstName} ${staff.lastName} has already checked out today.`);

  // ── Build checkout GPS ────────────────────────────────────────────────────
  const resolved = { ...data };
  if (data.latitude != null && data.longitude != null && !resolved.location) {
    resolved.location = `${data.latitude.toFixed(6)},${data.longitude.toFixed(6)}`;
  }

  // ── Remote checkout detection ─────────────────────────────────────────────
  let isRemoteCheckout = false;
  if (resolved.location) {
    const [latStr, lngStr] = resolved.location.split(",");
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    if (!isNaN(lat) && !isNaN(lng)) {
      const { checkGeoFence } = await import("@/lib/geoFence");
      isRemoteCheckout = !checkGeoFence(lat, lng).isWithinRange;
    }
  }

  // ── Status computation ────────────────────────────────────────────────────
  // Capture checkout time once — reused for totalHours AND the DB write so they are
  // always the same instant (no drift between service and repository new Date() calls).
  const checkInTime  = record.checkInTime!;
  const checkOutTime = new Date();
  const totalHours   = computeTotalHours(checkInTime, checkOutTime);
  const isLate       = computeIsLate(checkInTime);
  const isEarlyExit  = computeIsEarlyExit(checkOutTime);

  // Override WFH / leave from checkout payload if admin provides them
  const isWFH     = data.isWFH     ?? record.isWFH;
  const isOnLeave = data.isOnLeave ?? record.isOnLeave;

  // Check if staff has an active field visit today
  const today = new Date();
  const fieldVisits = await fieldVisitRepo.findFieldVisits({
    staffId: data.staffId,
    date: today.toISOString().slice(0, 10),
    page: 1,
    pageSize: 1,
  });
  const hasFieldVisit =
    fieldVisits.data.length > 0 &&
    ["APPROVED", "IN_PROGRESS", "COMPLETED"].includes(fieldVisits.data[0].status);

  const attendanceStatus = getAttendanceStatus({
    checkInTime,
    checkOutTime,
    totalHours,
    isLate,
    isEarlyExit,
    hasFieldVisit,
    isWFH,
    isOnLeave,
  });

  return attendanceRepo.updateCheckOut(record.id, resolved, {
    checkOutTime,   // ← same instant used for totalHours above
    isRemoteCheckout,
    totalHours,
    isEarlyExit,
    attendanceStatus,
    isWFH,
    isOnLeave,
  });
}

export async function checkInWithQR(data: QRCheckInInput) {
  const staff = await staffRepo.findStaffById(data.staffId);
  if (!staff) throw new Error(`Staff member not found: ${data.staffId}`);
  if (staff.status === "INACTIVE") throw new Error("Inactive staff cannot check in.");

  const { valid, token } = validateQRContent(data.qrContent);
  if (!valid) throw new Error("Invalid or expired QR code. Please scan today's QR code.");

  const existing = await attendanceRepo.findAttendanceRecord(data.staffId, new Date());
  if (existing) throw new Error(`${staff.firstName} ${staff.lastName} has already checked in today.`);

  // QR alone = +20; no GPS/selfie at this point (score = 20 → REJECTED by default)
  // Staff scanning QR at office entrance is implicitly on-premises, bump to FLAGGED minimum
  const confidenceScore  = computeConfidenceScore(false, false, true); // 20
  const validationStatus = getValidationStatus(confidenceScore);       // REJECTED (< 40)

  return attendanceRepo.createQRCheckIn(data.staffId, token!, {
    confidenceScore,
    validationStatus,
    hasQR: true,
  });
}

export async function getTodayAttendance() {
  return attendanceRepo.findTodayAttendance();
}

export async function getAttendanceByStaff(filters: AttendanceFiltersInput) {
  return attendanceRepo.findAttendanceByStaff(filters);
}

// Statuses that count as "present" in KPI
const PRESENT_STATUSES = new Set([
  "PRESENT", "LATE", "FULL_DAY", "HALF_DAY", "EARLY_EXIT", "FIELD_VISIT", "WFH",
]);
// Statuses that count as "late" in KPI
const LATE_STATUSES = new Set(["LATE"]);

export async function getAttendanceKPI(): Promise<AttendanceKPI> {
  const [totalStaff, statusGroups] = await Promise.all([
    staffRepo.countActiveStaff(),
    attendanceRepo.countTodayAttendanceByStatus(),
  ]);

  let presentToday = 0;
  let lateToday = 0;

  for (const row of statusGroups) {
    const s = row.attendanceStatus as string;
    if (PRESENT_STATUSES.has(s)) presentToday += row._count._all;
    if (LATE_STATUSES.has(s))    lateToday    += row._count._all;
  }

  const absentToday = totalStaff - presentToday;

  return {
    totalStaff,
    presentToday,
    absentToday: Math.max(0, absentToday),
    lateToday,
  };
}

// ---------------------------------------------------------------------------
// End-of-day processing
// ---------------------------------------------------------------------------

/**
 * Mark ABSENT for every active staff member with no check-in record today.
 * Safe to call multiple times — upserts idempotently.
 * Intended to run at / after 12:00 UTC via a scheduled job.
 */
export async function runEndOfDayProcessing(): Promise<{ marked: number }> {
  if (!isAbsentByNow()) {
    // It's before noon UTC — too early to mark anyone absent
    return { marked: 0 };
  }

  const today = new Date();
  const absentIds = await attendanceRepo.findStaffWithNoCheckIn(today);

  await Promise.all(
    absentIds.map((staffId) => attendanceRepo.upsertAbsentRecord(staffId, today))
  );

  return { marked: absentIds.length };
}
