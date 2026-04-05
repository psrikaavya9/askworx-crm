import { NextRequest, NextResponse } from "next/server";
import * as taskService from "@/modules/projects/services/task.service";
import { createTimeLogSchema } from "@/modules/projects/schemas/task.schema";
import { ZodError } from "zod";
import { serializePrisma } from "@/lib/serialize";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id: taskId } = await params;
    const logs = await taskService.getTimeLogsByTask(taskId);
    return NextResponse.json(serializePrisma(logs));
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Task not found"))
      return NextResponse.json({ error: err.message }, { status: 404 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id: taskId } = await params;
    const body = await req.json();
    const data = createTimeLogSchema.parse(body);
    const log = await taskService.createTimeLog(taskId, data);
    return NextResponse.json(serializePrisma(log), { status: 201 });
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    if (err instanceof Error && err.message.startsWith("Task not found"))
      return NextResponse.json({ error: err.message }, { status: 404 });
    if (err instanceof Error)
      return NextResponse.json({ error: err.message }, { status: 422 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
