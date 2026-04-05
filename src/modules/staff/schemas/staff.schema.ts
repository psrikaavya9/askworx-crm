import { z } from "zod";

// ---------------------------------------------------------------------------
// Create Staff
// ---------------------------------------------------------------------------

export const createStaffSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Invalid email address"),
  phone: z.string().max(30).optional(),
  role: z.enum(["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"]).optional().default("STAFF"),
  department: z.string().max(100).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional().default("ACTIVE"),
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>;

// ---------------------------------------------------------------------------
// Update Staff
// Note: defined explicitly (not .partial()) to avoid inheriting .default()
// values from createStaffSchema, which would silently reset role/status on
// every partial PATCH that omits those fields.
// ---------------------------------------------------------------------------

export const updateStaffSchema = z.object({
  firstName:  z.string().min(1, "First name is required").max(100).optional(),
  lastName:   z.string().min(1, "Last name is required").max(100).optional(),
  email:      z.string().email("Invalid email address").optional(),
  phone:      z.string().max(30).optional(),
  role:       z.enum(["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"]).optional(),
  department: z.string().max(100).optional(),
  status:     z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;

// ---------------------------------------------------------------------------
// Staff list filters
// ---------------------------------------------------------------------------

export const staffFiltersSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  role: z.enum(["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"]).optional(),
  department: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  sortBy: z
    .enum(["createdAt", "updatedAt", "firstName", "lastName", "email"])
    .optional()
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

export type StaffFiltersInput = z.infer<typeof staffFiltersSchema>;
