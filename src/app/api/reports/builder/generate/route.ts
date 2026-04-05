import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateReport } from "@/modules/reports/services/builder.service";
import { serializePrisma } from "@/lib/serialize";

const schema = z.object({
  module: z.string(),
  selectedFields: z.array(z.string()).default([]),
  filters: z.array(z.object({
    field: z.string(),
    operator: z.string(),
    value: z.string(),
  })).default([]),
  limit: z.number().max(1000).default(1000),
});

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    const result = await generateReport(body as Parameters<typeof generateReport>[0]);
    return NextResponse.json(serializePrisma(result));
  } catch (err) {
    console.error("[builder/generate]", err);
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
