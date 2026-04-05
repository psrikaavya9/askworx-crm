import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const [won, lost] = await Promise.all([
    prisma.lead.count({ where: { stage: "WON" } }),
    prisma.lead.count({ where: { stage: "LOST" } }),
  ]);

  return NextResponse.json([
    { status: "WON", count: won },
    { status: "LOST", count: lost },
  ]);
}
