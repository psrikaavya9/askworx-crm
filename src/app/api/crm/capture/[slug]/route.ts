import { NextRequest, NextResponse } from "next/server";
import * as captureService from "@/modules/crm/services/capture.service";
import { serializePrisma } from "@/lib/serialize";

type Params = { params: Promise<{ slug: string }> };

/** Returns form field definitions for rendering the embed form */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { slug } = await params;
    const forms = await captureService.getCaptureForms(true);
    const form = forms.find((f: { slug: string }) => f.slug === slug);
    if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 });
    // Return only what's needed for the public embed
    return NextResponse.json(serializePrisma({
      name: form.name,
      description: form.description,
      fields: form.fields,
      thankYouMsg: form.thankYouMsg,
      redirectUrl: form.redirectUrl,
    }));
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** Public submission endpoint — no auth required */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { slug } = await params;
    const body = await req.json();
    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      req.headers.get("x-real-ip") ??
      undefined;
    const userAgent = req.headers.get("user-agent") ?? undefined;

    const result = await captureService.handleSubmission(slug, body, { ipAddress, userAgent });
    return NextResponse.json(serializePrisma(result), { status: 201 });
  } catch (err) {
    if (err instanceof Error && (err.message.includes("not found") || err.message.includes("inactive")))
      return NextResponse.json({ error: err.message }, { status: 404 });
    if (err instanceof Error && err.message.includes("Missing required"))
      return NextResponse.json({ error: err.message }, { status: 400 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
