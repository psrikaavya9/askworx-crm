import { NextRequest, NextResponse } from "next/server";
import * as attendanceService from "@/modules/staff/services/attendance.service";
import { checkOutSchema } from "@/modules/staff/schemas/attendance.schema";
import { ZodError } from "zod";
import { serializePrisma } from "@/lib/serialize";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = checkOutSchema.parse(body);
    const record = await attendanceService.checkOut(data);
    return NextResponse.json(serializePrisma(record));
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    if (err instanceof Error)
      return NextResponse.json({ error: err.message }, { status: 422 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
