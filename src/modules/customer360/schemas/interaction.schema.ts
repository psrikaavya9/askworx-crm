import { z } from "zod";

// ---------------------------------------------------------------------------
// Create interaction (CALL / VISIT / NOTE)
// staffId is NOT accepted from the body — it is always derived from the
// authenticated user's JWT (user.sub) to prevent staff logging on behalf of
// others without authorisation.
// ---------------------------------------------------------------------------

export const createInteractionSchema = z.object({
  clientId:     z.string().min(1, "Client ID is required"),
  type:         z.enum(["CALL", "VISIT", "NOTE", "EMAIL", "WHATSAPP"]),
  date:         z.string().datetime({ message: "date must be a valid ISO 8601 string" }),

  // CALL / VISIT: duration in minutes
  duration:     z.coerce.number().int().positive().optional(),

  // Free-text outcome (e.g. "Demo agreed", "No answer")
  outcome:      z.string().optional(),
  notes:        z.string().optional(),

  // VISIT: GPS coordinates captured at the time of the visit
  gpsLat:       z.coerce.number().min(-90).max(90).optional(),
  gpsLng:       z.coerce.number().min(-180).max(180).optional(),

  // VISIT: array of photo URLs attached to the visit
  photos:       z.array(z.string()).optional(),

  nextFollowUp: z.string().datetime({ message: "nextFollowUp must be a valid ISO 8601 string" }).optional(),

  // EMAIL / WHATSAPP: messaging-specific fields
  direction:          z.enum(["INBOUND", "OUTBOUND"]).optional(),
  messageContent:     z.string().optional(),
  messageSubject:     z.string().optional(),
  counterpartyEmail:  z.string().email().optional(),
  counterpartyPhone:  z.string().optional(),
});

export type CreateInteractionInput = z.infer<typeof createInteractionSchema>;

// ---------------------------------------------------------------------------
// List / filter interactions
// clientId is required — interactions are always queried per client
// ---------------------------------------------------------------------------

export const interactionFiltersSchema = z.object({
  clientId: z.string().min(1, "clientId query parameter is required"),
  type:     z.enum(["CALL", "VISIT", "NOTE", "EMAIL", "WHATSAPP"]).optional(),
  page:     z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type InteractionFiltersInput = z.infer<typeof interactionFiltersSchema>;

// ---------------------------------------------------------------------------
// Approve — ownerNote is optional (acknowledgement note)
// ---------------------------------------------------------------------------

export const approveInteractionSchema = z.object({
  ownerNote: z.string().optional(),
});

export type ApproveInteractionInput = z.infer<typeof approveInteractionSchema>;

// ---------------------------------------------------------------------------
// Reject — ownerNote is required (rejection reason must be supplied)
// ---------------------------------------------------------------------------

export const rejectInteractionSchema = z.object({
  ownerNote: z.string().min(1, "Rejection reason is required"),
});

export type RejectInteractionInput = z.infer<typeof rejectInteractionSchema>;

// ---------------------------------------------------------------------------
// Request Edit — owner asks staff to revise and resubmit.
// ownerNote is required so staff know exactly what to fix.
// Sets approved=false, rejected=false, ownerNote=<instructions>.
// ---------------------------------------------------------------------------

export const requestEditSchema = z.object({
  ownerNote: z.string().min(1, "Edit instructions are required"),
});

export type RequestEditInput = z.infer<typeof requestEditSchema>;

// ---------------------------------------------------------------------------
// Review list filters — owner dashboard (no clientId required)
// ---------------------------------------------------------------------------

export const reviewFiltersSchema = z.object({
  status:   z.enum(["PENDING", "EDIT_REQUESTED", "ALL"]).optional().default("ALL"),
  type:     z.enum(["CALL", "VISIT", "NOTE", "EMAIL", "WHATSAPP"]).optional(),
  staffId:  z.string().optional(),
  clientId: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo:   z.string().datetime().optional(),
  page:     z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).optional().default(30),
});

export type ReviewFiltersInput = z.infer<typeof reviewFiltersSchema>;

// ---------------------------------------------------------------------------
// Bulk action — apply approve / reject / request-edit to multiple interactions
// ---------------------------------------------------------------------------

export const bulkActionSchema = z.object({
  ids:      z.array(z.string().min(1)).min(1, "At least one ID is required").max(50, "Max 50 at a time"),
  action:   z.enum(["approve", "reject", "request-edit"]),
  reason:   z.string().optional(),    // required for reject (dropdown category)
  note:     z.string().max(500).optional(), // optional free-text for reject / request-edit
});

export type BulkActionInput = z.infer<typeof bulkActionSchema>;
