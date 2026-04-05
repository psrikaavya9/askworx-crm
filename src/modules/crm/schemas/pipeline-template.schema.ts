import { z } from "zod";

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

export const DEAL_TYPES = ["PRODUCT", "SERVICE", "AMC"] as const;
export type DealType = (typeof DEAL_TYPES)[number];

export const createTemplateSchema = z.object({
  name:        z.string().min(1).max(100),
  dealType:    z.enum(DEAL_TYPES),
  description: z.string().max(500).optional(),
  isActive:    z.boolean().optional().default(true),
});

export const updateTemplateSchema = createTemplateSchema.partial();

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;

// ---------------------------------------------------------------------------
// Stage config
// ---------------------------------------------------------------------------

export const createStageSchema = z.object({
  name:        z.string().min(1).max(100),
  order:       z.number().int().min(0),
  probability: z.number().int().min(0).max(100).optional().default(0),
  color:       z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex color").optional().default("#6366f1"),
  isWon:       z.boolean().optional().default(false),
  isLost:      z.boolean().optional().default(false),
});

export const updateStageConfigSchema = createStageSchema.partial();

export const reorderStagesSchema = z.object({
  // Array of { id, order } — caller sends the full new order
  stages: z.array(z.object({ id: z.string(), order: z.number().int().min(0) })).min(1),
});

export type CreateStageInput      = z.infer<typeof createStageSchema>;
export type UpdateStageConfigInput = z.infer<typeof updateStageConfigSchema>;
export type ReorderStagesInput    = z.infer<typeof reorderStagesSchema>;

// ---------------------------------------------------------------------------
// Assign pipeline to lead
// ---------------------------------------------------------------------------

export const assignPipelineSchema = z.object({
  templateId:  z.string().min(1),
  stageId:     z.string().optional(), // if omitted → first stage of template
});

export type AssignPipelineInput = z.infer<typeof assignPipelineSchema>;

// ---------------------------------------------------------------------------
// Move stage
// ---------------------------------------------------------------------------

export const moveStageSchema = z.object({
  stageId:   z.string().min(1),
  reason:    z.string().max(500).optional(),
  changedBy: z.string().min(1),
});

export type MoveStageInput = z.infer<typeof moveStageSchema>;
