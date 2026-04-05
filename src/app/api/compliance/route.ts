import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { withAuth } from "@/lib/middleware/authMiddleware";
import { withRole } from "@/lib/middleware/roleCheck";
import { logAudit } from "@/lib/audit";
import {
  createComplianceSchema,
  listComplianceSchema,
} from "@/modules/compliance/schemas/compliance.schema";
import {
  listComplianceItems,
  createComplianceItem,
} from "@/modules/compliance/services/compliance.service";

// ---------------------------------------------------------------------------
// GET /api/compliance  (any authenticated user)
//
// Optional query params: status, type, frequency
// Results ordered by nextDueDate asc (most urgent first).
// ---------------------------------------------------------------------------

export const GET = withAuth(async (req: NextRequest) => {
  try {
    const raw     = Object.fromEntries(req.nextUrl.searchParams);
    const filters = listComplianceSchema.parse(raw);
    const items   = await listComplianceItems(filters);
    return NextResponse.json(items);
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

// ---------------------------------------------------------------------------
// POST /api/compliance  (minimum role: ADMIN)
// ---------------------------------------------------------------------------

export const POST = withRole("ADMIN", async (req: NextRequest, user) => {
  try {
    const body = await req.json();
    const data = createComplianceSchema.parse(body);
    const item = await createComplianceItem(data);

    logAudit(user.sub, "COMPLIANCE_CREATED", "compliance", item.id, {
      title: item.title,
      type:  item.type,
      nextDueDate: item.nextDueDate,
    });

    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    if (err instanceof Error)
      return NextResponse.json({ error: err.message }, { status: 422 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
