import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRole } from "@/lib/middleware/roleCheck";
import { AccessTokenPayload } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// PATCH /api/staff/[id]/force-reset
//
// Admin action: sets forcePasswordReset = true on a staff member.
// On the target user's NEXT login, they will be blocked with code
// FORCE_PASSWORD_RESET and must change their password before accessing the app.
//
// Permission: ADMIN and above
// Cannot be applied to OWNER accounts (only an OWNER can manage another OWNER)
//
// Body (optional):
//   { reason?: string }   // audit note — not stored, just logged server-side
//
// Response:
//   200 → { success: true, message }
//   403 → not permitted
//   404 → staff not found
// ---------------------------------------------------------------------------

export const PATCH = withRole("ADMIN", async (req: NextRequest, actor: AccessTokenPayload, ctx?: Ctx) => {
  const { id: targetId } = await ctx!.params;

  // Optional audit note
  let reason: string | undefined;
  try {
    const body = await req.json() as { reason?: string };
    reason = typeof body.reason === "string" ? body.reason.trim() : undefined;
  } catch {
    // Body is optional — ignore parse errors
  }

  // ── Find target account ──────────────────────────────────────────────────
  const target = await prisma.staff.findUnique({
    where:  { id: targetId },
    select: { id: true, role: true, status: true, firstName: true, lastName: true },
  });

  if (!target) {
    return NextResponse.json(
      { success: false, error: "Staff member not found" },
      { status: 404 }
    );
  }

  // ── Prevent applying to self ─────────────────────────────────────────────
  if (target.id === actor.sub) {
    return NextResponse.json(
      { success: false, error: "You cannot force-reset your own password from this endpoint" },
      { status: 400 }
    );
  }

  // ── Only OWNER can force-reset another OWNER ─────────────────────────────
  if (target.role === "OWNER" && actor.role !== "OWNER") {
    return NextResponse.json(
      { success: false, error: "Only an OWNER can force-reset another OWNER's password", code: "FORBIDDEN" },
      { status: 403 }
    );
  }

  // ── Set flag ─────────────────────────────────────────────────────────────
  await prisma.staff.update({
    where: { id: targetId },
    data:  { forcePasswordReset: true },
  });

  const name = `${target.firstName} ${target.lastName}`.trim();
  console.log(`[force-reset] ${name} (${targetId}) flagged by ${actor.email}${reason ? ` — reason: ${reason}` : ""}`);

  return NextResponse.json({
    success: true,
    message: `${name} will be required to change their password on next login.`,
  });
});
