import { NextResponse } from "next/server";
import * as attendanceService from "@/modules/staff/services/attendance.service";
import { serializePrisma } from "@/lib/serialize";

export async function GET() {
  try {
    const result = await attendanceService.getTodayAttendance();
    return NextResponse.json(serializePrisma(result));
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
