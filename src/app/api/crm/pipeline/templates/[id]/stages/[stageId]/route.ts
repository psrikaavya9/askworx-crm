import { NextRequest, NextResponse } from "next/server";
import * as svc from "@/modules/crm/services/pipeline-template.service";
import { updateStageConfigSchema } from "@/modules/crm/schemas/pipeline-template.schema";
import { ZodError } from "zod";
import { serializePrisma } from "@/lib/serialize";

type Params = { params: Promise<{ id: string; stageId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id, stageId } = await params;
    const body = await req.json();
    const data = updateStageConfigSchema.parse(body);
    const stage = await svc.updateStage(id, stageId, data);
    return NextResponse.json(serializePrisma(stage));
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    if (err instanceof Error && err.message.includes("not found"))
      return NextResponse.json({ error: err.message }, { status: 404 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id, stageId } = await params;
    await svc.deleteStage(id, stageId);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof Error && err.message.includes("not found"))
      return NextResponse.json({ error: err.message }, { status: 404 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
