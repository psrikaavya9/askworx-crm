import { z } from "zod";

export const reportFiltersSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  staffId: z.string().optional(),
  projectId: z.string().optional(),
  status: z.string().optional(),
  type: z.string().optional(),
  category: z.string().optional(),
});

export type ReportFiltersInput = z.infer<typeof reportFiltersSchema>;
