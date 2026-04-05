import { z } from "zod";

export const createClientSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().max(30).optional(),
  company: z.string().min(1).max(200),
  jobTitle: z.string().max(100).optional(),
  website: z.string().url().optional(),
  address: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  assignedTo: z.string().optional(),
  notes: z.string().max(5000).optional(),
  tags: z.array(z.string()).optional().default([]),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;

export const updateClientSchema = createClientSchema.partial();

export type UpdateClientInput = z.infer<typeof updateClientSchema>;

export const clientFiltersSchema = z.object({
  search: z.string().optional(),
  assignedTo: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  sortBy: z
    .enum(["createdAt", "company", "firstName", "email"])
    .optional()
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

export type ClientFiltersInput = z.infer<typeof clientFiltersSchema>;

// ---------------------------------------------------------------------------
// Lead Capture Form
// ---------------------------------------------------------------------------

const formFieldSchema = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["text", "email", "phone", "textarea", "select", "checkbox"]),
  required: z.boolean(),
  placeholder: z.string().optional(),
  options: z.array(z.string()).optional(),
});

export const createCaptureFormSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, numbers, and hyphens"),
  description: z.string().max(500).optional(),
  fields: z.array(formFieldSchema).min(1, "At least one field is required"),
  defaultStage: z
    .enum(["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"])
    .optional()
    .default("NEW"),
  defaultSource: z
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
    .default("WEBSITE"),
  assignedTo: z.string().optional(),
  redirectUrl: z.string().url().optional(),
  thankYouMsg: z.string().max(500).optional(),
  isActive: z.boolean().optional().default(true),
});

export type CreateCaptureFormInput = z.infer<typeof createCaptureFormSchema>;

export const updateCaptureFormSchema = createCaptureFormSchema.partial();
export type UpdateCaptureFormInput = z.infer<typeof updateCaptureFormSchema>;
