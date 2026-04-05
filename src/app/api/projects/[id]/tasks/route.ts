import { NextRequest, NextResponse } from "next/server";
import * as taskService from "@/modules/projects/services/task.service";
import {
  createTaskSchema,
  taskFiltersSchema,
} from "@/modules/projects/schemas/task.schema";
import { ZodError } from "zod";
import { serializePrisma } from "@/lib/serialize";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id: projectId } = await params;
    const rawParams = Object.fromEntries(req.nextUrl.searchParams.entries());
    const filters = taskFiltersSchema.parse(rawParams);
    const result = await taskService.getTasksByProject(projectId, filters);
    return NextResponse.json(serializePrisma(result));
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    if (err instanceof Error && err.message.startsWith("Project not found"))
      return NextResponse.json({ error: err.message }, { status: 404 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id: projectId } = await params;
    const body = await req.json();
    const data = createTaskSchema.parse(body);
    const task = await taskService.createTask(projectId, data);
    return NextResponse.json(serializePrisma(task), { status: 201 });
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    if (err instanceof Error && err.message.startsWith("Project not found"))
      return NextResponse.json({ error: err.message }, { status: 404 });
    if (err instanceof Error)
      return NextResponse.json({ error: err.message }, { status: 422 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
