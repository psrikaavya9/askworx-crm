import { NextRequest, NextResponse } from "next/server";
import * as leadService from "@/modules/crm/services/lead.service";
import { createReminderSchema } from "@/modules/crm/schemas/lead.schema";
import { ZodError } from "zod";
import { serializePrisma } from "@/lib/serialize";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const reminders = await leadService.getReminders(id);
    return NextResponse.json(serializePrisma(reminders));
  } catch (err) {
    if (err instanceof Error && err.message.includes("not found"))
      return NextResponse.json({ error: err.message }, { status: 404 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();
    const data = createReminderSchema.parse(body);
    const reminder = await leadService.createReminder(id, data);
    return NextResponse.json(serializePrisma(reminder), { status: 201 });
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    if (err instanceof Error && err.message.includes("not found"))
      return NextResponse.json({ error: err.message }, { status: 404 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
