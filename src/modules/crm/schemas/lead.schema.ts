import { z } from "zod";

// ---------------------------------------------------------------------------
// Create Lead
// ---------------------------------------------------------------------------

export const createLeadSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Invalid email address"),
  phone: z.string().max(30).optional(),
  company: z.string().max(200).optional(),
  jobTitle: z.string().max(100).optional(),
  source: z
    .enum([
      "WEBSITE",
      "REFERRAL",
      "SOCIAL_MEDIA",
      "EMAIL_CAMPAIGN",
      "COLD_CALL",
      "TRADE_SHOW",
      "PARTNER",
      "OTHER",
    ])
    .optional()
    .default("OTHER"),
  sourceDetail: z.string().max(255).optional(),
  stage: z
    .enum(["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"])
    .optional()
    .default("NEW"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional().default("MEDIUM"),
  dealValue: z.number().positive().optional(),
  currency: z.string().length(3).optional().default("USD"),
  assignedTo: z.string().optional(),
  tags: z.array(z.string()).optional().default([]),
  companySize: z.enum(["SMALL", "MEDIUM", "LARGE", "ENTERPRISE"]).optional(),
  industry: z.string().max(100).optional(),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;

// ---------------------------------------------------------------------------
// Update Lead
// ---------------------------------------------------------------------------

export const updateLeadSchema = createLeadSchema.partial();

export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;

// ---------------------------------------------------------------------------
// Update Stage
// ---------------------------------------------------------------------------

export const updateStageSchema = z.object({
  stage: z.enum(["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"]),
  lostReason: z.string().max(500).optional(),
});

export type UpdateStageInput = z.infer<typeof updateStageSchema>;

// ---------------------------------------------------------------------------
// Add Note
// ---------------------------------------------------------------------------

export const addNoteSchema = z.object({
  content: z.string().min(1, "Note content is required").max(5000),
  createdBy: z.string().min(1),
});

export type AddNoteInput = z.infer<typeof addNoteSchema>;

// ---------------------------------------------------------------------------
// Create Reminder
// ---------------------------------------------------------------------------

export const createReminderSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(1000).optional(),
  dueAt: z.string().datetime({ message: "Invalid date-time" }),
  assignedTo: z.string().min(1, "Assignee is required"),
  createdBy: z.string().min(1),
});

export type CreateReminderInput = z.infer<typeof createReminderSchema>;

// ---------------------------------------------------------------------------
// Update Reminder
// ---------------------------------------------------------------------------

export const updateReminderSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  dueAt: z.string().datetime().optional(),
  status: z.enum(["PENDING", "COMPLETED", "DISMISSED", "OVERDUE"]).optional(),
});

export type UpdateReminderInput = z.infer<typeof updateReminderSchema>;

// ---------------------------------------------------------------------------
// Duplicate check  (POST /api/crm/leads/check-duplicates)
// ---------------------------------------------------------------------------

export const duplicateCheckSchema = z.object({
  email:     z.string().email(),
  phone:     z.string().max(30).optional(),
  firstName: z.string().min(1).max(100),
  lastName:  z.string().min(1).max(100),
  company:   z.string().max(200).optional(),
  /** Exclude a specific lead ID — used when checking during an update. */
  excludeId: z.string().optional(),
});

export type DuplicateCheckBody = z.infer<typeof duplicateCheckSchema>;

// ---------------------------------------------------------------------------
// Merge leads  (POST /api/crm/leads/merge)
// ---------------------------------------------------------------------------

export const mergeLeadsSchema = z.object({
  /** The lead to keep. All notes, activities and reminders are moved here. */
  targetId:    z.string().min(1),
  /** The lead to absorb then delete. */
  sourceId:    z.string().min(1),
  performedBy: z.string().optional().default("admin"),
});

export type MergeLeadsInput = z.infer<typeof mergeLeadsSchema>;

// ---------------------------------------------------------------------------
// Bulk assign  (POST /api/crm/leads/bulk-assign)
// ---------------------------------------------------------------------------

export const bulkAssignSchema = z.object({
  lead_ids:    z.array(z.string().min(1)).min(1, "At least one lead ID is required"),
  assigned_to: z.string().min(1, "Assignee is required"),
  overwrite:   z.boolean().optional().default(false),
  performedBy: z.string().optional().default("system"),
});

export type BulkAssignInput = z.infer<typeof bulkAssignSchema>;

// ---------------------------------------------------------------------------
// Auto-distribute  (POST /api/crm/leads/auto-distribute)
// ---------------------------------------------------------------------------

export const autoDistributeSchema = z.object({
  /** Leads to distribute. Omit to distribute all unassigned leads. */
  lead_ids:    z.array(z.string().min(1)).optional(),
  /** Staff to assign to. Omit to use all ACTIVE staff. */
  staff_ids:   z.array(z.string().min(1)).optional(),
  performedBy: z.string().optional().default("system"),
});

export type AutoDistributeInput = z.infer<typeof autoDistributeSchema>;

// ---------------------------------------------------------------------------
// Bulk delete  (DELETE /api/crm/leads/bulk-delete)
// ---------------------------------------------------------------------------

export const bulkDeleteSchema = z.object({
  lead_ids: z.array(z.string().min(1)).min(1, "At least one lead ID is required"),
});

export type BulkDeleteInput = z.infer<typeof bulkDeleteSchema>;

// ---------------------------------------------------------------------------
// Bulk move stage  (POST /api/crm/leads/bulk-stage)
// ---------------------------------------------------------------------------

export const bulkMoveStageSchema = z.object({
  lead_ids:    z.array(z.string().min(1)).min(1, "At least one lead ID is required"),
  stage:       z.enum(["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"]),
  performedBy: z.string().optional().default("system"),
});

export type BulkMoveStageInput = z.infer<typeof bulkMoveStageSchema>;

// ---------------------------------------------------------------------------
// Lead list filters
// ---------------------------------------------------------------------------

export const leadFiltersSchema = z.object({
  stage: z
    .enum(["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"])
    .optional(),
  source: z
    .enum([
      "WEBSITE",
      "REFERRAL",
      "SOCIAL_MEDIA",
      "EMAIL_CAMPAIGN",
      "COLD_CALL",
      "TRADE_SHOW",
      "PARTNER",
      "OTHER",
    ])
    .optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  scoreCategory: z.enum(["HOT", "WARM", "COLD"]).optional(),
  assignedTo: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  sortBy: z
    .enum(["createdAt", "updatedAt", "dealValue", "firstName", "company"])
    .optional()
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

export type LeadFiltersInput = z.infer<typeof leadFiltersSchema>;
