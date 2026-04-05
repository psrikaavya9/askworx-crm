import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/middleware/authMiddleware";

// ---------------------------------------------------------------------------
// GET /api/expenses/locations
//
// Returns approved expense coordinates for the geo heatmap.
// Only rows with both gpsLat and gpsLng set are included.
// Capped at 1000 rows to protect rendering performance.
// ---------------------------------------------------------------------------

export const GET = withAuth(async () => {
  const rows = await prisma.expense.findMany({
    where: {
      status: "APPROVED",
      gpsLat: { not: null },
      gpsLng: { not: null },
    },
    select: {
      id:       true,
      gpsLat:   true,
      gpsLng:   true,
      amount:   true,
      category: true,
    },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });

  const data = rows.map((r) => ({
    id:       r.id,
    lat:      r.gpsLat!,
    lng:      r.gpsLng!,
    amount:   Number(r.amount),
    category: r.category,
  }));

  return NextResponse.json(data);
});
