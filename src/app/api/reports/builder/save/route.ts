import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { saveReport } from "@/modules/reports/services/builder.service";
import { serializePrisma } from "@/lib/serialize";

const schema = z.object({
  name: z.string().min(1).max(100),
  module: z.string(),
  selectedFields: z.array(z.string()).default([]),
  filters: z.array(z.object({
    field: z.string(),
    operator: z.string(),
    value: z.string(),
  })).default([]),
});

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    const result = await saveReport(body as Parameters<typeof saveReport>[0]);
    return NextResponse.json(serializePrisma(result), { status: 201 });
  } catch (err) {
    console.error("[builder/save]", err);
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to save report" }, { status: 500 });
  }
}
