import { z } from "zod";

// ---------------------------------------------------------------------------
// Create Task
// ---------------------------------------------------------------------------

export const createTaskSchema = z.object({
  title: z.string().min(1, "Task title is required").max(300),
  description: z.string().max(5000).optional(),
  assignedStaff: z.array(z.string()).optional().default([]),
  status: z
    .enum(["TODO", "IN_PROGRESS", "DONE"])
    .optional()
    .default("TODO"),
  priority: z
    .enum(["LOW", "MEDIUM", "HIGH"])
    .optional()
    .default("MEDIUM"),
  dueDate: z.string().datetime({ message: "Invalid due date" }).optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

// ---------------------------------------------------------------------------
// Update Task
// ---------------------------------------------------------------------------

export const updateTaskSchema = createTaskSchema.partial();

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

// ---------------------------------------------------------------------------
// Task list filters
// ---------------------------------------------------------------------------

export const taskFiltersSchema = z.object({
  projectId: z.string().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  assignedStaff: z.string().optional(), // filter by a single User ID
  search: z.string().optional(),
  overdue: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  sortBy: z
    .enum(["createdAt", "updatedAt", "title", "dueDate", "priority"])
    .optional()
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

export type TaskFiltersInput = z.infer<typeof taskFiltersSchema>;

// ---------------------------------------------------------------------------
// Create TimeLog
// ---------------------------------------------------------------------------

export const createTimeLogSchema = z.object({
  hours: z
    .number()
    .positive("Hours must be greater than 0")
    .max(24, "Cannot log more than 24 hours at once"),
  note: z.string().max(1000).optional(),
  loggedAt: z.string().datetime({ message: "Invalid loggedAt date" }).optional(),
});

export type CreateTimeLogInput = z.infer<typeof createTimeLogSchema>;

// ---------------------------------------------------------------------------
// Update TimeLog
// ---------------------------------------------------------------------------

export const updateTimeLogSchema = z.object({
  hours: z.number().positive().max(24).optional(),
  note: z.string().max(1000).optional(),
  loggedAt: z.string().datetime().optional(),
});

export type UpdateTimeLogInput = z.infer<typeof updateTimeLogSchema>;
