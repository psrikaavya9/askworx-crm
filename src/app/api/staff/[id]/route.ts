import { NextRequest, NextResponse } from "next/server";
import * as staffService from "@/modules/staff/services/staff.service";
import { updateStaffSchema } from "@/modules/staff/schemas/staff.schema";
import { ZodError } from "zod";
import { serializePrisma } from "@/lib/serialize";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const staff = await staffService.getStaffById(id);
    return NextResponse.json(serializePrisma(staff));
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Staff member not found"))
      return NextResponse.json({ error: err.message }, { status: 404 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();
    const data = updateStaffSchema.parse(body);
    const staff = await staffService.updateStaff(id, data);
    return NextResponse.json(serializePrisma(staff));
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    if (err instanceof Error && err.message.startsWith("Staff member not found"))
      return NextResponse.json({ error: err.message }, { status: 404 });
    if (err instanceof Error)
      return NextResponse.json({ error: err.message }, { status: 422 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    await staffService.deleteStaff(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Staff member not found"))
      return NextResponse.json({ error: err.message }, { status: 404 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
