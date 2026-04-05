import { NextResponse } from "next/server";
import { generateTodayQRToken, getTodayDateString, buildQRContent, OFFICE_ID } from "@/lib/qr-token";

/** GET /api/attendance/qr — returns today's QR payload for the admin display screen. */
export async function GET() {
  const date      = getTodayDateString();
  const token     = generateTodayQRToken(OFFICE_ID);
  const qrContent = buildQRContent(OFFICE_ID);

  return NextResponse.json({ token, date, qrContent, officeId: OFFICE_ID });
}
