import { NextRequest, NextResponse } from "next/server";
import * as projectService from "@/modules/projects/services/project.service";
import { updateProjectSchema } from "@/modules/projects/schemas/project.schema";
import { ZodError } from "zod";
import { serializePrisma } from "@/lib/serialize";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const project = await projectService.getProjectById(id);
    return NextResponse.json(serializePrisma(project));
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Project not found"))
      return NextResponse.json({ error: err.message }, { status: 404 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();
    const data = updateProjectSchema.parse(body);
    const project = await projectService.updateProject(id, data);
    return NextResponse.json(serializePrisma(project));
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

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    await projectService.deleteProject(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Project not found"))
      return NextResponse.json({ error: err.message }, { status: 404 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
