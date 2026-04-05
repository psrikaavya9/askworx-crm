import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/middleware/roleCheck";
import { analyticsFiltersSchema, resolveAnalyticsFilters } from "@/modules/finance/schemas/expenseAnalytics.schema";
import { getAnalyticsByEmployee } from "@/modules/finance/repositories/expenseAnalytics.repository";

export const GET = withRole("ADMIN", async (req: NextRequest) => {
  const raw = analyticsFiltersSchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const filters = resolveAnalyticsFilters(raw);
  const data = await getAnalyticsByEmployee(filters);
  return NextResponse.json({ success: true, data });
});
