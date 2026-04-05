import { NextRequest, NextResponse } from "next/server";
import * as invoiceService from "@/modules/finance/services/invoice.service";
import { createInvoiceSchema, invoiceFiltersSchema } from "@/modules/finance/schemas/invoice.schema";
import { ZodError } from "zod";
import { serializePrisma } from "@/lib/serialize";
import { logAudit } from "@/lib/audit";
import { withAuth } from "@/lib/middleware/authMiddleware";
import { withRole } from "@/lib/middleware/roleCheck";

// ---------------------------------------------------------------------------
// GET /api/invoices  (minimum role: STAFF — any authenticated user can read)
// ---------------------------------------------------------------------------

export const GET = withAuth(async (req: NextRequest) => {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const filters = invoiceFiltersSchema.parse(params);
    const result = await invoiceService.getInvoices(filters);
    return NextResponse.json(serializePrisma(result));
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

// ---------------------------------------------------------------------------
// POST /api/invoices  (minimum role: ADMIN — accounts team and above)
// ---------------------------------------------------------------------------

export const POST = withRole("ADMIN", async (req: NextRequest, user) => {
  try {
    const body = await req.json();
    const data = createInvoiceSchema.parse(body);
    const invoice = await invoiceService.createInvoice(data);

    logAudit(user.sub, "INVOICE_CREATED", "invoice", invoice.id, {
      invoiceNumber: invoice.invoiceNumber,
      clientId: invoice.clientId,
      totalAmount: Number(invoice.totalAmount),
      status: invoice.status,
    });

    return NextResponse.json(serializePrisma(invoice), { status: 201 });
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    if (err instanceof Error && err.message.includes("already exists"))
      return NextResponse.json({ error: err.message }, { status: 409 });
    if (err instanceof Error)
      return NextResponse.json({ error: err.message }, { status: 422 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
