import { NextRequest, NextResponse } from "next/server";
import * as svc from "@/modules/crm/services/pipeline-template.service";
import { reorderStagesSchema } from "@/modules/crm/schemas/pipeline-template.schema";
import { ZodError } from "zod";
import { serializePrisma } from "@/lib/serialize";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();
    const data = reorderStagesSchema.parse(body);
    const updated = await svc.reorderStages(id, data);
    return NextResponse.json(serializePrisma(updated));
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    if (err instanceof Error && err.message.includes("not found"))
      return NextResponse.json({ error: err.message }, { status: 404 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
