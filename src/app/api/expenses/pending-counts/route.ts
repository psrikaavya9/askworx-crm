import { NextResponse } from "next/server";
import { withRole } from "@/lib/middleware/roleCheck";
import * as expenseService from "@/modules/finance/services/expense.service";

export const GET = withRole("ADMIN", async () => {
  const counts = await expenseService.getPendingCounts();
  return NextResponse.json({ success: true, ...counts });
});
