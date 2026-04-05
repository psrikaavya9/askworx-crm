import { z } from "zod";

const complianceType      = z.enum(["INTERNAL", "STATUTORY"]);
const complianceFrequency = z.enum(["MONTHLY", "QUARTERLY", "YEARLY"]);

export const createComplianceSchema = z.object({
  title:        z.string().min(1, "Title is required").max(200),
  type:         complianceType,
  frequency:    complianceFrequency,
  nextDueDate:  z.coerce.date(),
  lastDoneDate: z.coerce.date().optional(),
  notes:        z.string().max(2000).optional(),
  // Optional link to an HrDocument; when set, document expiry drives status
  hrDocumentId: z.string().uuid().optional(),
});

export const updateComplianceSchema = z.object({
  title:        z.string().min(1).max(200).optional(),
  type:         complianceType.optional(),
  frequency:    complianceFrequency.optional(),
  nextDueDate:  z.coerce.date().optional(),
  notes:        z.string().max(2000).optional().nullable(),
  // Set this to mark the item as completed and trigger next-cycle recalculation
  markComplete: z.boolean().optional(),
  // Link or re-link to an HrDocument; pass null to remove the link
  hrDocumentId: z.string().uuid().optional().nullable(),
});

export const listComplianceSchema = z.object({
  status:    z.enum(["PENDING", "UPCOMING", "OVERDUE", "COMPLETED"]).optional(),
  type:      z.enum(["INTERNAL", "STATUTORY"]).optional(),
  frequency: z.enum(["MONTHLY", "QUARTERLY", "YEARLY"]).optional(),
});

export type CreateComplianceInput = z.infer<typeof createComplianceSchema>;
export type UpdateComplianceInput = z.infer<typeof updateComplianceSchema>;
export type ListComplianceInput   = z.infer<typeof listComplianceSchema>;
