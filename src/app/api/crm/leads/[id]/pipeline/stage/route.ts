import { NextRequest, NextResponse } from "next/server";
import * as svc from "@/modules/crm/services/pipeline-template.service";
import { moveStageSchema } from "@/modules/crm/schemas/pipeline-template.schema";
import { ZodError } from "zod";
import { serializePrisma } from "@/lib/serialize";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();
    const changedBy = req.headers.get("x-user-id") ?? "system";
    const data = moveStageSchema.parse({ ...body, changedBy });
    const lp = await svc.moveStage(id, data);
    return NextResponse.json(serializePrisma(lp));
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    if (err instanceof Error)
      return NextResponse.json({ error: err.message }, { status: err.message.includes("not found") ? 404 : 400 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
