import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/middleware/authMiddleware";

// ---------------------------------------------------------------------------
// GET /api/auth/me
//
// Protected. Returns full profile of the authenticated staff member.
// ---------------------------------------------------------------------------

export const GET = withAuth(async (_req: NextRequest, user) => {
  const staff = await prisma.staff.findUnique({
    where: { id: user.sub },
    select: {
      id:         true,
      firstName:  true,
      lastName:   true,
      email:      true,
      phone:      true,
      role:       true,
      department: true,
      status:     true,
      createdAt:  true,
      // Never select passwordHash
    },
  });

  if (!staff) {
    return NextResponse.json(
      { success: false, error: "User not found" },
      { status: 404 }
    );
  }

  if (staff.status !== "ACTIVE") {
    return NextResponse.json(
      { success: false, error: "Account is inactive" },
      { status: 403 }
    );
  }

  return NextResponse.json({ success: true, data: staff });
});
