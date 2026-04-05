import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/authMiddleware";
import { roleCheck } from "@/lib/middleware/roleCheck";
import { reviewFiltersSchema } from "@/modules/customer360/schemas/interaction.schema";
import * as svc from "@/modules/customer360/services/interaction.service";

// ---------------------------------------------------------------------------
// GET /api/reviews
//
// Returns all interactions that have not been approved, for the Owner
// review dashboard. Supports filtering by status and type.
//
// Query params:
//   status   "PENDING" | "EDIT_REQUESTED" | "ALL" (default: ALL)
//   type     "CALL" | "VISIT" | "NOTE"
//   page     number (default: 1)
//   pageSize number (default: 30, max: 100)
//
// Restricted to OWNER only.
// ---------------------------------------------------------------------------

export const GET = withAuth(
  roleCheck(["OWNER"])(async (req: NextRequest) => {
    const { searchParams } = new URL(req.url);

    const parsed = reviewFiltersSchema.safeParse({
      status:   searchParams.get("status")   ?? undefined,
      type:     searchParams.get("type")     ?? undefined,
      page:     searchParams.get("page")     ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await svc.listPendingForReview(parsed.data);
    return NextResponse.json({ success: true, ...result });
  }),
);
