import { NextRequest, NextResponse } from "next/server";
import * as leadService from "@/modules/crm/services/lead.service";
import { updateStageSchema } from "@/modules/crm/schemas/lead.schema";
import { ZodError } from "zod";
import { serializePrisma } from "@/lib/serialize";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();
    const data = updateStageSchema.parse(body);

    // In a real app, extract performedBy from the auth session
    const performedBy = req.headers.get("x-user-id") ?? "system";

    const lead = await leadService.updateLeadStage(id, data, performedBy);
    return NextResponse.json(serializePrisma(lead));
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    if (err instanceof Error && err.message.includes("not found"))
      return NextResponse.json({ error: err.message }, { status: 404 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
