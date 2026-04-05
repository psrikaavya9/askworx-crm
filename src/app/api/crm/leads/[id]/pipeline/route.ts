import { NextRequest, NextResponse } from "next/server";
import * as svc from "@/modules/crm/services/pipeline-template.service";
import { assignPipelineSchema } from "@/modules/crm/schemas/pipeline-template.schema";
import { ZodError } from "zod";
import { serializePrisma } from "@/lib/serialize";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const lp = await svc.getLeadPipeline(id);
    if (!lp) return NextResponse.json({ error: "No pipeline assigned to this lead" }, { status: 404 });
    return NextResponse.json(serializePrisma(lp));
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();
    const data = assignPipelineSchema.parse(body);
    const lp = await svc.assignPipeline(id, data);
    return NextResponse.json(serializePrisma(lp), { status: 201 });
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    if (err instanceof Error)
      return NextResponse.json({ error: err.message }, { status: 400 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
