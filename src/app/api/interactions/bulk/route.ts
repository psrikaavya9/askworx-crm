import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/authMiddleware";
import { roleCheck } from "@/lib/middleware/roleCheck";
import { bulkActionSchema } from "@/modules/customer360/schemas/interaction.schema";
import * as svc from "@/modules/customer360/services/interaction.service";

// ---------------------------------------------------------------------------
// POST /api/interactions/bulk
//
// Bulk approve / reject / request-edit for multiple interactions.
// OWNER only.
//
// Body:
//   ids      string[]   — list of interaction IDs (max 50)
//   action   string     — "approve" | "reject" | "request-edit"
//   reason   string?    — rejection reason category (required for reject)
//   note     string?    — optional free-text note
// ---------------------------------------------------------------------------

export const POST = withAuth(
  roleCheck(["OWNER"])(async (req: NextRequest, user) => {
    const body   = await req.json().catch(() => ({}));
    const parsed = bulkActionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten() },
        { status: 400 },
      );
    }

    if (parsed.data.action === "reject" && !parsed.data.reason) {
      return NextResponse.json(
        { success: false, error: "reason is required for bulk reject" },
        { status: 400 },
      );
    }

    const reviewer = {
      reviewedBy: user.sub,
      reviewedAt: new Date(),
    };

    const result = await svc.bulkReviewAction(parsed.data, reviewer);

    return NextResponse.json({ success: true, ...result });
  }),
);
