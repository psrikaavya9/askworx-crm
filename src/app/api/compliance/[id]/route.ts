import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { withRole } from "@/lib/middleware/roleCheck";
import { logAudit } from "@/lib/audit";
import { updateComplianceSchema } from "@/modules/compliance/schemas/compliance.schema";
import { updateComplianceItem } from "@/modules/compliance/services/compliance.service";

type Ctx = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// PATCH /api/compliance/:id  (minimum role: ADMIN)
//
// Two modes via the request body:
//
//   1. markComplete: true
//      → stamps lastDoneDate = today
//      → advances nextDueDate by one cycle
//      → recalculates status
//
//   2. Any other fields (title, type, frequency, nextDueDate, notes)
//      → plain field update
//      → status recalculated from the resulting nextDueDate
// ---------------------------------------------------------------------------

export const PATCH = withRole("ADMIN", async (req: NextRequest, user, ctx?: Ctx) => {
  try {
    const { id } = await ctx!.params;
    const body   = await req.json();
    const data   = updateComplianceSchema.parse(body);
    const item   = await updateComplianceItem(id, data);

    logAudit(user.sub, "COMPLIANCE_UPDATED", "compliance", id, {
      markComplete: data.markComplete ?? false,
      status:       item.status,
      nextDueDate:  item.nextDueDate,
    });

    return NextResponse.json(item);
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    if (err instanceof Error && err.message.includes("not found"))
      return NextResponse.json({ error: err.message }, { status: 404 });
    if (err instanceof Error)
      return NextResponse.json({ error: err.message }, { status: 422 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
