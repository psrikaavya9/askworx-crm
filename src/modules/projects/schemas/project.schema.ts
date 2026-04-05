import { z } from "zod";

// ---------------------------------------------------------------------------
// Create Project
// ---------------------------------------------------------------------------

export const createProjectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(200),
  description: z.string().max(5000).optional(),
  startDate: z.string().datetime({ message: "Invalid start date" }).optional(),
  deadline: z.string().datetime({ message: "Invalid deadline" }).optional(),
  status: z
    .enum(["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED"])
    .optional()
    .default("PLANNING"),
  clientId: z.string().optional(),
  invoiceIds: z.array(z.string()).optional().default([]),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

// ---------------------------------------------------------------------------
// Update Project
// ---------------------------------------------------------------------------

export const updateProjectSchema = createProjectSchema.partial();

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

// ---------------------------------------------------------------------------
// Project list filters
// ---------------------------------------------------------------------------

export const projectFiltersSchema = z.object({
  status: z.enum(["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED"]).optional(),
  clientId: z.string().optional(),
  search: z.string().optional(),
  overdue: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  sortBy: z
    .enum(["createdAt", "updatedAt", "name", "deadline", "startDate"])
    .optional()
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

export type ProjectFiltersInput = z.infer<typeof projectFiltersSchema>;
