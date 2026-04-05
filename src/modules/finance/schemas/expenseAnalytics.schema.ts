import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared filter schema — used by all /api/expenses/analytics/* routes
// ---------------------------------------------------------------------------

export const analyticsFiltersSchema = z.object({
  from:     z.coerce.date().optional(),
  to:       z.coerce.date().optional(),
  category: z.string().optional(),
  staffId:  z.string().optional(),
});

export type AnalyticsRawFilters = z.infer<typeof analyticsFiltersSchema>;

export interface AnalyticsFilters {
  from:     Date;
  to:       Date;
  category: string | undefined;
  staffId:  string | undefined;
}

/**
 * Apply defaults: if `from`/`to` are absent, default to the current calendar month.
 */
export function resolveAnalyticsFilters(raw: AnalyticsRawFilters): AnalyticsFilters {
  const now = new Date();
  return {
    from:     raw.from ?? new Date(now.getFullYear(), now.getMonth(), 1),
    to:       raw.to   ?? new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
    category: raw.category,
    staffId:  raw.staffId,
  };
}
