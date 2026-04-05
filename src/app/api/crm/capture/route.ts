import { NextRequest, NextResponse } from "next/server";
import * as captureService from "@/modules/crm/services/capture.service";
import { createCaptureFormSchema } from "@/modules/crm/schemas/client.schema";
import { ZodError } from "zod";

export async function GET() {
  try {
    const forms = await captureService.getCaptureForms();
    return NextResponse.json(forms);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = createCaptureFormSchema.parse(body);
    const form = await captureService.createCaptureForm(data);
    return NextResponse.json(form, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    if (err instanceof Error)
      return NextResponse.json({ error: err.message }, { status: 409 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
