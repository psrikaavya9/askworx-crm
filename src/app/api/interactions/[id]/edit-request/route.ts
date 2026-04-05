import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// PATCH /api/interactions/:id/edit-request
// Body: { message: string }
// State after: approved=false, rejected=false, ownerNote=<message>
// ---------------------------------------------------------------------------

const schema = z.object({
  message: z.string().min(1, "message is required").max(500),
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
      { success: false, error: "message is required (max 500 chars)" },
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
      { success: false, error: "Cannot request edit on an approved interaction" },
      { status: 422 },
    );
  }

  const updated = await prisma.customerInteraction.update({
    where: { id },
    data:  { approved: false, rejected: false, ownerNote: parsed.data.message },
  });

  console.log(`[edit-request] interaction=${id} clientId=${updated.clientId} → sent back for edit`);

  revalidateTag(`c360-${updated.clientId}`, "default");

  return NextResponse.json({ success: true, data: updated });
}
