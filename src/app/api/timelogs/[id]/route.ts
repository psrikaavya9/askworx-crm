import { NextRequest, NextResponse } from "next/server";
import * as taskService from "@/modules/projects/services/task.service";
import { updateTimeLogSchema } from "@/modules/projects/schemas/task.schema";
import { ZodError } from "zod";
import { serializePrisma } from "@/lib/serialize";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();
    const data = updateTimeLogSchema.parse(body);
    const log = await taskService.updateTimeLog(id, data);
    return NextResponse.json(serializePrisma(log));
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    if (err instanceof Error && err.message.startsWith("TimeLog not found"))
      return NextResponse.json({ error: err.message }, { status: 404 });
    if (err instanceof Error)
      return NextResponse.json({ error: err.message }, { status: 422 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    await taskService.deleteTimeLog(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("TimeLog not found"))
      return NextResponse.json({ error: err.message }, { status: 404 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
