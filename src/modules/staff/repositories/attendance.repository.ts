import { prisma } from "@/lib/prisma";
import type { Prisma, CheckInMethod, AttendanceStatus } from "@/generated/prisma/client";
import type { CheckInInput, CheckOutInput, AttendanceFiltersInput } from "../schemas/attendance.schema";
import type { PaginatedResult, TodayAttendanceRow } from "../types";
import type { RichAttendanceStatus } from "@/lib/attendanceStatus";

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/** Normalise a Date to midnight UTC (date-only semantics). */
export function toDateOnly(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Late threshold: 09:00 UTC */
const LATE_HOUR_UTC = 9;

function resolveAttendanceStatus(checkInTime: Date): "PRESENT" | "LATE" {
  return checkInTime.getUTCHours() >= LATE_HOUR_UTC ? "LATE" : "PRESENT";
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function findTodayAttendance(): Promise<TodayAttendanceRow[]> {
  const today = toDateOnly();

  const staff = await prisma.staff.findMany({
    where: { status: "ACTIVE" },
    orderBy: { firstName: "asc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      department: true,
      role: true,
      attendances: {
        where: { date: today },
        take: 1,
      },
    },
  });

  return staff.map((s) => ({
    staff: {
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      department: s.department,
      role: s.role,
    },
    attendance: s.attendances[0] ?? null,
  }));
}

export async function findAttendanceByStaff(
  filters: AttendanceFiltersInput
): Promise<PaginatedResult<Awaited<ReturnType<typeof prisma.attendance.findMany>>[number] & { staff: { firstName: string; lastName: string; email: string; department: string | null; role: string } }>> {
  const { page, pageSize, sortBy, sortOrder } = filters;
  const skip = (page - 1) * pageSize;

  const where: Prisma.AttendanceWhereInput = {};
  if (filters.staffId) where.staffId = filters.staffId;
  if (filters.attendanceStatus) where.attendanceStatus = filters.attendanceStatus;
  if (filters.date) {
    const d = toDateOnly(new Date(filters.date));
    where.date = d;
  }

  const data = await prisma.attendance.findMany({
    where,
    orderBy: { [sortBy]: sortOrder },
    skip,
    take: pageSize,
    include: {
      staff: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          department: true,
          role: true,
        },
      },
    },
  });
  const total = await prisma.attendance.count({ where });

  return {
    data: data as never,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function findAttendanceRecord(staffId: string, date: Date) {
  return prisma.attendance.findUnique({
    where: { staffId_date: { staffId, date: toDateOnly(date) } },
  });
}

export async function countTodayAttendanceByStatus() {
  const today = toDateOnly();
  return prisma.attendance.groupBy({
    by: ["attendanceStatus"],
    where: { date: today },
    _count: { _all: true },
  });
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

export async function createCheckIn(
  data: CheckInInput,
  extras?: {
    method?: CheckInMethod;
    qrToken?: string;
    confidenceScore?: number;
    validationStatus?: "VALID" | "FLAGGED" | "REJECTED";
    hasGPS?: boolean;
    hasSelfie?: boolean;
    hasQR?: boolean;
  }
) {
  const now = new Date();
  const today = toDateOnly(now);
  const status = resolveAttendanceStatus(now);

  return prisma.attendance.create({
    data: {
      staffId:          data.staffId,
      date:             today,
      checkInTime:      now,
      checkInLocation:  data.location,
      checkInSelfie:    data.selfie,
      selfieUrl:        data.selfie?.startsWith("/") ? data.selfie : null,
      attendanceStatus: status,
      method:           extras?.method,
      qrToken:          extras?.qrToken,
      confidenceScore:  extras?.confidenceScore ?? 0,
      validationStatus: extras?.validationStatus ?? "FLAGGED",
      hasGPS:           extras?.hasGPS ?? false,
      hasSelfie:        extras?.hasSelfie ?? false,
      hasQR:            extras?.hasQR ?? false,
      isWFH:            data.isWFH  ?? false,
      isOnLeave:        data.isOnLeave ?? false,
    },
    include: {
      staff: { select: { firstName: true, lastName: true, email: true } },
    },
  });
}

export async function createQRCheckIn(
  staffId: string,
  qrToken: string,
  extras?: {
    confidenceScore?: number;
    validationStatus?: "VALID" | "FLAGGED" | "REJECTED";
    hasQR?: boolean;
  }
) {
  const now = new Date();
  const today = toDateOnly(now);
  const status = resolveAttendanceStatus(now);

  return prisma.attendance.create({
    data: {
      staffId,
      date:             today,
      checkInTime:      now,
      attendanceStatus: status,
      method:           "QR",
      qrToken,
      confidenceScore:  extras?.confidenceScore ?? 20,
      validationStatus: extras?.validationStatus ?? "REJECTED",
      hasGPS:           false,
      hasSelfie:        false,
      hasQR:            extras?.hasQR ?? true,
    },
    include: {
      staff: { select: { firstName: true, lastName: true, email: true } },
    },
  });
}

export async function updateCheckOut(
  attendanceId: string,
  data: CheckOutInput,
  extras?: {
    /** Exact checkout timestamp — must match the value used for totalHours computation. */
    checkOutTime?:     Date;
    isRemoteCheckout?: boolean;
    totalHours?:       number;
    isEarlyExit?:      boolean;
    attendanceStatus?: RichAttendanceStatus;
    isWFH?:            boolean;
    isOnLeave?:        boolean;
  }
) {
  // Use the caller-supplied timestamp (so totalHours and checkOutTime are consistent).
  // Fall back to now() only if the service did not compute one.
  const checkOutTime = extras?.checkOutTime ?? new Date();

  return prisma.attendance.update({
    where: { id: attendanceId },
    data: {
      checkOutTime,
      checkOutLocation: data.location,
      checkOutSelfie:   data.selfie,
      checkOutGPS:      data.location ?? null,
      isRemoteCheckout: extras?.isRemoteCheckout ?? false,
      totalHours:       extras?.totalHours   != null ? extras.totalHours   : undefined,
      isEarlyExit:      extras?.isEarlyExit  != null ? extras.isEarlyExit  : undefined,
      attendanceStatus: (extras?.attendanceStatus as AttendanceStatus | undefined) ?? undefined,
      isWFH:            extras?.isWFH        != null ? extras.isWFH        : undefined,
      isOnLeave:        extras?.isOnLeave    != null ? extras.isOnLeave    : undefined,
    },
    include: {
      staff: { select: { firstName: true, lastName: true, email: true } },
    },
  });
}

// ---------------------------------------------------------------------------
// End-of-day helpers
// ---------------------------------------------------------------------------

/** IDs of active staff who have no attendance record for `date`. */
export async function findStaffWithNoCheckIn(date: Date): Promise<string[]> {
  const day = toDateOnly(date);
  const allActive = await prisma.staff.findMany({
    where: { status: "ACTIVE" },
    select: { id: true },
  });
  const checkedIn = await prisma.attendance.findMany({
    where: { date: day },
    select: { staffId: true },
  });
  const checkedInSet = new Set(checkedIn.map((r) => r.staffId));
  return allActive.map((s) => s.id).filter((id) => !checkedInSet.has(id));
}

/** Create an ABSENT record for a staff member for the given date (idempotent). */
export async function upsertAbsentRecord(staffId: string, date: Date) {
  const day = toDateOnly(date);
  return prisma.attendance.upsert({
    where: { staffId_date: { staffId, date: day } },
    create: {
      staffId,
      date: day,
      attendanceStatus: "ABSENT",
    },
    // No-op if a real check-in record already exists (race condition guard).
    // findStaffWithNoCheckIn already filters to staff without records,
    // so this branch only fires if someone checked in between the two DB calls.
    update: {},
  });
}

/** Update only the attendanceStatus on an existing record (e.g. end-of-day recompute). */
export async function updateAttendanceStatus(
  attendanceId: string,
  status: AttendanceStatus,
  extras?: { totalHours?: number; isEarlyExit?: boolean }
) {
  return prisma.attendance.update({
    where: { id: attendanceId },
    data: {
      attendanceStatus: status,
      ...(extras?.totalHours  != null && { totalHours:  extras.totalHours }),
      ...(extras?.isEarlyExit != null && { isEarlyExit: extras.isEarlyExit }),
    },
  });
}
