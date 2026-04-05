import { NextRequest, NextResponse } from "next/server";
import * as leadService from "@/modules/crm/services/lead.service";
import { updateLeadSchema } from "@/modules/crm/schemas/lead.schema";
import { ZodError } from "zod";
import { serializePrisma } from "@/lib/serialize";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const lead = await leadService.getLeadById(id);
    return NextResponse.json(serializePrisma(lead));
  } catch (err) {
    if (err instanceof Error && err.message.includes("not found"))
      return NextResponse.json({ error: err.message }, { status: 404 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();
    const data = updateLeadSchema.parse(body);
    const lead = await leadService.updateLead(id, data);
    return NextResponse.json(serializePrisma(lead));
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    if (err instanceof Error && err.message.includes("not found"))
      return NextResponse.json({ error: err.message }, { status: 404 });
    if (err instanceof Error)
      return NextResponse.json({ error: err.message }, { status: 409 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    await leadService.deleteLead(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof Error && err.message.includes("not found"))
      return NextResponse.json({ error: err.message }, { status: 404 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
