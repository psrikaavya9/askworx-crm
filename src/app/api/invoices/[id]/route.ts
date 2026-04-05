import { NextRequest, NextResponse } from "next/server";
import * as invoiceService from "@/modules/finance/services/invoice.service";
import { updateInvoiceSchema } from "@/modules/finance/schemas/invoice.schema";
import { ZodError } from "zod";
import { serializePrisma } from "@/lib/serialize";
import { logAudit } from "@/lib/audit";
import { withAuth } from "@/lib/middleware/authMiddleware";
import { withRole } from "@/lib/middleware/roleCheck";

type Ctx = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// GET /api/invoices/[id]  (any authenticated user)
// ---------------------------------------------------------------------------

export const GET = withAuth(async (_req: NextRequest, _user, ctx?: Ctx) => {
  try {
    const { id } = await ctx!.params;
    const invoice = await invoiceService.getInvoiceById(id);
    return NextResponse.json(serializePrisma(invoice));
  } catch (err) {
    if (err instanceof Error && err.message.includes("not found"))
      return NextResponse.json({ error: err.message }, { status: 404 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/invoices/[id]  (minimum role: ADMIN)
// ---------------------------------------------------------------------------

export const PATCH = withRole("ADMIN", async (req: NextRequest, user, ctx?: Ctx) => {
  try {
    const { id } = await ctx!.params;
    const body = await req.json();
    const data = updateInvoiceSchema.parse(body);
    const invoice = await invoiceService.updateInvoice(id, data);

    logAudit(user.sub, "INVOICE_UPDATED", "invoice", id, {
      fields: Object.keys(data),
      status: data.status,
    });

    return NextResponse.json(serializePrisma(invoice));
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    if (err instanceof Error && err.message.includes("not found"))
      return NextResponse.json({ error: err.message }, { status: 404 });
    if (err instanceof Error)
      return NextResponse.json({ error: err.message }, { status: 400 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/invoices/[id]  (minimum role: OWNER — irreversible action)
// ---------------------------------------------------------------------------

export const DELETE = withRole("OWNER", async (_req: NextRequest, user, ctx?: Ctx) => {
  try {
    const { id } = await ctx!.params;
    await invoiceService.deleteInvoice(id);

    logAudit(user.sub, "INVOICE_DELETED", "invoice", id);

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof Error && err.message.includes("not found"))
      return NextResponse.json({ error: err.message }, { status: 404 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
