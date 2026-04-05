import { NextRequest, NextResponse } from "next/server";
import * as svc from "@/modules/crm/services/pipeline-template.service";
import { createTemplateSchema } from "@/modules/crm/schemas/pipeline-template.schema";
import { ZodError } from "zod";
import { serializePrisma } from "@/lib/serialize";

export async function GET(req: NextRequest) {
  try {
    const activeOnly = req.nextUrl.searchParams.get("activeOnly") === "true";
    const templates = await svc.listTemplates(activeOnly);
    return NextResponse.json(serializePrisma(templates));
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = createTemplateSchema.parse(body);
    const template = await svc.createTemplate(data);
    return NextResponse.json(serializePrisma(template), { status: 201 });
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
