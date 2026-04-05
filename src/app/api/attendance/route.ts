import { NextRequest, NextResponse } from "next/server";
import * as attendanceService from "@/modules/staff/services/attendance.service";
import { attendanceFiltersSchema } from "@/modules/staff/schemas/attendance.schema";
import { ZodError } from "zod";
import { serializePrisma } from "@/lib/serialize";

export async function GET(req: NextRequest) {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const filters = attendanceFiltersSchema.parse(params);
    const result = await attendanceService.getAttendanceByStaff(filters);
    return NextResponse.json(serializePrisma(result));
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
