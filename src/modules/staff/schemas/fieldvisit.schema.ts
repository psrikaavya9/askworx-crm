import { z } from "zod";

// ---------------------------------------------------------------------------
// Create field visit
// ---------------------------------------------------------------------------

export const createFieldVisitSchema = z.object({
  staffId:    z.string().min(1, "Staff ID is required"),
  date:       z.string().optional(),   // ISO date; defaults to today
  clientName: z.string().optional(),
  purpose:    z.string().min(1, "Purpose is required"),
  notes:      z.string().optional(),
});

export type CreateFieldVisitInput = z.infer<typeof createFieldVisitSchema>;

// ---------------------------------------------------------------------------
// Add GPS waypoint
// ---------------------------------------------------------------------------

export const addWaypointSchema = z.object({
  latitude:  z.coerce.number(),
  longitude: z.coerce.number(),
  timestamp: z.string().optional(), // ISO string; defaults to now
});

export type AddWaypointInput = z.infer<typeof addWaypointSchema>;

// ---------------------------------------------------------------------------
// Review (approve / reject)
// ---------------------------------------------------------------------------

export const reviewFieldVisitSchema = z.object({
  action:      z.enum(["approve", "reject"]),
  reviewerId:  z.string().min(1, "Reviewer ID is required"),
  reviewNote:  z.string().optional(),
});

export type ReviewFieldVisitInput = z.infer<typeof reviewFieldVisitSchema>;

// ---------------------------------------------------------------------------
// List filters
// ---------------------------------------------------------------------------

export const fieldVisitFiltersSchema = z.object({
  staffId:  z.string().optional(),
  status:   z.enum(["PENDING", "APPROVED", "REJECTED", "IN_PROGRESS", "COMPLETED"]).optional(),
  date:     z.string().optional(),
  page:     z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type FieldVisitFiltersInput = z.infer<typeof fieldVisitFiltersSchema>;
