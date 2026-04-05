import { NextResponse } from "next/server";
import * as projectService from "@/modules/projects/services/project.service";
import { serializePrisma } from "@/lib/serialize";

export async function GET() {
  try {
    const kpi = await projectService.getProjectKPIs();
    return NextResponse.json(serializePrisma(kpi));
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
