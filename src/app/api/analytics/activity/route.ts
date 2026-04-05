import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const [calls, emails, whatsapp] = await Promise.all([
    prisma.customerInteraction.count({ where: { type: "CALL" } }),
    prisma.customerInteraction.count({ where: { type: "EMAIL" } }),
    prisma.customerInteraction.count({ where: { type: "WHATSAPP" } }),
  ]);

  return NextResponse.json({ calls, emails, whatsapp });
}
