import { z } from "zod";

// ---------------------------------------------------------------------------
// Check In
// ---------------------------------------------------------------------------

export const checkInSchema = z.object({
  staffId:   z.string().min(1, "Staff ID is required"),
  location:  z.string().optional(),           // "lat,lng" combined string (legacy)
  latitude:  z.coerce.number().optional(),    // discrete lat from GPS capture
  longitude: z.coerce.number().optional(),    // discrete lng from GPS capture
  selfie:    z.string().optional(),           // base64 data URL or raw base64
  method:    z.enum(["GPS", "SELFIE", "QR"]).optional(), // client-declared method
  qrContent: z.string().optional(),           // scanned QR payload "OFFICE_ID:TOKEN"
  isWFH:     z.boolean().optional(),          // staff declaring WFH at check-in
  isOnLeave: z.boolean().optional(),          // admin-marked leave at check-in
});

// ---------------------------------------------------------------------------
// QR Check In
// ---------------------------------------------------------------------------

export const qrCheckInSchema = z.object({
  staffId: z.string().min(1, "Staff ID is required"),
  qrContent: z.string().min(1, "QR content is required"),
});

export type QRCheckInInput = z.infer<typeof qrCheckInSchema>;

export type CheckInInput = z.infer<typeof checkInSchema>;

// ---------------------------------------------------------------------------
// Check Out
// ---------------------------------------------------------------------------

export const checkOutSchema = z.object({
  staffId:   z.string().min(1, "Staff ID is required"),
  location:  z.string().optional(),
  latitude:  z.coerce.number().optional(),  // discrete lat for checkout GPS
  longitude: z.coerce.number().optional(),  // discrete lng for checkout GPS
  selfie:    z.string().optional(),
  isWFH:     z.boolean().optional(),        // override WFH flag at checkout
  isOnLeave: z.boolean().optional(),        // override leave flag at checkout
});

export type CheckOutInput = z.infer<typeof checkOutSchema>;

// ---------------------------------------------------------------------------
// Attendance list filters
// ---------------------------------------------------------------------------

const ALL_ATTENDANCE_STATUSES = [
  // Final 8 statuses
  "FULL_DAY", "HALF_DAY", "LATE", "EARLY_EXIT",
  "ABSENT", "ON_LEAVE", "FIELD_VISIT", "WFH",
  // Interim (while staff is checked in but not yet checked out)
  "PRESENT",
] as const;

export const attendanceFiltersSchema = z.object({
  staffId: z.string().optional(),
  date: z.string().optional(),          // ISO date string "YYYY-MM-DD"
  attendanceStatus: z.enum(ALL_ATTENDANCE_STATUSES).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  sortBy: z.enum(["date", "createdAt", "checkInTime"]).optional().default("date"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

export type AttendanceFiltersInput = z.infer<typeof attendanceFiltersSchema>;
