import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRole } from "@/lib/middleware/roleCheck";

// ---------------------------------------------------------------------------
// GET /api/expenses/rejections  (minimum role: ADMIN)
//
// Returns all-time rejection reason counts, covering both:
//   - REJECTED     → manual rejection; reason stored in rejectionReason
//   - AUTO_REJECTED → system rejection; reason stored in flagReason
//
// Both are merged into a single ranked list by count descending.
// Rows where the reason field is null are excluded.
// ---------------------------------------------------------------------------

export const GET = withRole("ADMIN", async () => {
  const [manualRows, autoRows] = await Promise.all([
    // Manual rejections — reason set by the approver
    prisma.expense.groupBy({
      by:      ["rejectionReason"],
      where:   { status: "REJECTED", rejectionReason: { not: null } },
      _count:  true,
      orderBy: { _count: { rejectionReason: "desc" } },
    }),
    // Auto-rejections — reason set by the validation pipeline (GPS / receipt layer)
    prisma.expense.groupBy({
      by:      ["flagReason"],
      where:   { status: "AUTO_REJECTED", flagReason: { not: null } },
      _count:  true,
      orderBy: { _count: { flagReason: "desc" } },
    }),
  ]);

  // Merge both sources into a single reason → count map
  const countMap = new Map<string, number>();

  for (const row of manualRows) {
    if (!row.rejectionReason) continue;
    countMap.set(row.rejectionReason, (countMap.get(row.rejectionReason) ?? 0) + row._count);
  }

  for (const row of autoRows) {
    if (!row.flagReason) continue;
    countMap.set(row.flagReason, (countMap.get(row.flagReason) ?? 0) + row._count);
  }

  // Sort by count descending
  const data = Array.from(countMap.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json(data);
});
