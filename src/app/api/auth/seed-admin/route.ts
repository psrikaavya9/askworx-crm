import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// POST /api/auth/seed-admin
//
// DEV ONLY — creates or updates a staff member's password.
// Disabled in production.
//
// Body: { email, password, firstName?, lastName?, role? }
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { success: false, error: "Not available in production" },
      { status: 403 }
    );
  }

  const body = await req.json() as {
    email:      string;
    password:   string;
    firstName?: string;
    lastName?:  string;
    role?:      "ADMIN" | "MANAGER" | "STAFF";
  };

  if (!body.email || !body.password) {
    return NextResponse.json(
      { success: false, error: "email and password are required" },
      { status: 400 }
    );
  }

  if (body.password.length < 8) {
    return NextResponse.json(
      { success: false, error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(body.password, 12);

  // Upsert — create if not exists, update password if exists
  const staff = await prisma.staff.upsert({
    where: { email: body.email.toLowerCase().trim() },
    update: { passwordHash },
    create: {
      email:        body.email.toLowerCase().trim(),
      firstName:    body.firstName ?? "Admin",
      lastName:     body.lastName  ?? "User",
      role:         body.role      ?? "ADMIN",
      status:       "ACTIVE",
      passwordHash,
    },
    select: { id: true, email: true, firstName: true, lastName: true, role: true },
  });

  return NextResponse.json({
    success: true,
    message: "Staff member created/updated with password",
    data:    staff,
  });
}
