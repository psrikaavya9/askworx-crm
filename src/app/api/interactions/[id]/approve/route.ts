import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// PATCH /api/interactions/:id/approve
// ---------------------------------------------------------------------------

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

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
      { success: false, error: "Interaction is already approved" },
      { status: 422 },
    );
  }

  const updated = await prisma.customerInteraction.update({
    where: { id },
    data:  { approved: true, rejected: false },
  });

  console.log(`[approve] interaction=${id} clientId=${updated.clientId} → approved`);

  // Bust the Customer 360 cache for this client so the timeline
  // reflects the newly approved interaction on the next page load.
  revalidateTag(`c360-${updated.clientId}`, "default");

  return NextResponse.json({ success: true, data: updated });
}
