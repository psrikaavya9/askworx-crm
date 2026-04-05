import { NextRequest, NextResponse } from "next/server";
import * as staffService from "@/modules/staff/services/staff.service";
import { createStaffSchema, staffFiltersSchema } from "@/modules/staff/schemas/staff.schema";
import { ZodError } from "zod";
import { serializePrisma } from "@/lib/serialize";

export async function GET(req: NextRequest) {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const filters = staffFiltersSchema.parse(params);
    const result = await staffService.getAllStaff(filters);
    return NextResponse.json(serializePrisma(result));
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = createStaffSchema.parse(body);
    const staff = await staffService.createStaff(data);
    return NextResponse.json(serializePrisma(staff), { status: 201 });
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    if (err instanceof Error)
      return NextResponse.json({ error: err.message }, { status: 409 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
