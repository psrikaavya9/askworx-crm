import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// POST /api/auth/seed-admin
// GET  /api/auth/seed-admin?secret=<SEED_SECRET>
//
// Creates or updates the admin staff account.
// In production, requires ?secret=SEED_SECRET env var as a guard.
//
// Body (POST): { email, password, firstName?, lastName?, role? }
// Query (GET): uses defaults — admin@askworx.com / admin123456
// ---------------------------------------------------------------------------

async function seedAdmin(opts: {
  email:      string;
  password:   string;
  firstName?: string;
  lastName?:  string;
  role?:      "ADMIN" | "MANAGER" | "STAFF";
}) {
  const passwordHash = await bcrypt.hash(opts.password, 12);

  const staff = await prisma.staff.upsert({
    where: { email: opts.email.toLowerCase().trim() },
    update: { passwordHash },
    create: {
      email:        opts.email.toLowerCase().trim(),
      firstName:    opts.firstName ?? "Admin",
      lastName:     opts.lastName  ?? "User",
      role:         opts.role      ?? "ADMIN",
      status:       "ACTIVE",
      passwordHash,
    },
    select: { id: true, email: true, firstName: true, lastName: true, role: true },
  });

  return staff;
}

export async function GET(req: NextRequest) {
  // Production guard — require ?secret= matching SEED_SECRET env var
  if (process.env.NODE_ENV === "production") {
    const secret = req.nextUrl.searchParams.get("secret");
    if (!secret || secret !== process.env.SEED_SECRET) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }
  }

  try {
    const staff = await seedAdmin({
      email:    "admin@askworx.com",
      password: "admin123456",
    });

    return NextResponse.json({
      success: true,
      message: "Admin seeded. Email: admin@askworx.com / Password: admin123456",
      data:    staff,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[seed-admin] Error:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Production guard — require ?secret= matching SEED_SECRET env var
  if (process.env.NODE_ENV === "production") {
    const secret = req.nextUrl.searchParams.get("secret");
    if (!secret || secret !== process.env.SEED_SECRET) {
      return NextResponse.json(
        { success: false, error: "Not available in production without SEED_SECRET" },
        { status: 403 }
      );
    }
  }

  let body: { email?: unknown; password?: unknown; firstName?: unknown; lastName?: unknown; role?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.email !== "string" || typeof body.password !== "string") {
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

  try {
    const staff = await seedAdmin({
      email:     body.email,
      password:  body.password,
      firstName: typeof body.firstName === "string" ? body.firstName : undefined,
      lastName:  typeof body.lastName  === "string" ? body.lastName  : undefined,
      role:      (body.role as "ADMIN" | "MANAGER" | "STAFF") ?? undefined,
    });

    return NextResponse.json({
      success: true,
      message: "Staff member created/updated with password",
      data:    staff,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[seed-admin] Error:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
