import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// PATCH /api/interactions/:id/reject
// Body: { reason: string }
// ---------------------------------------------------------------------------

const schema = z.object({
  reason: z.string().min(1, "reason is required").max(500),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const body   = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "reason is required (max 500 chars)" },
      { status: 400 },
    );
  }

  const existing = await prisma.customerInteraction.findUnique({
    where:  { id },
    select: { id: true, approved: true },
  });

  if (!existing) {
    return NextResponse.json(
      { success: false, error: "Interaction not found" },
      { status: 404 },
    );
  }

  if (existing.approved) {
    return NextResponse.json(
      { success: false, error: "Cannot reject an approved interaction" },
      { status: 422 },
    );
  }

  const updated = await prisma.customerInteraction.update({
    where: { id },
    data:  { rejected: true, approved: false, ownerNote: parsed.data.reason },
  });

  console.log(`[reject] interaction=${id} clientId=${updated.clientId} → rejected`);

  revalidateTag(`c360-${updated.clientId}`, "default");

  return NextResponse.json({ success: true, data: updated });
}
