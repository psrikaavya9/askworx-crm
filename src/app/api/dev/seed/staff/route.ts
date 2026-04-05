import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/dev/seed/staff
 * Creates demo staff members (John Doe, Jane Smith, Michael Brown).
 * Idempotent — will not create duplicates.
 */
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const demoStaff = [
    {
      firstName: "John",
      lastName: "Doe",
      email: "john.doe@askworx.com",
      phone: "+1 555 100 0001",
      role: "MANAGER" as const,
      department: "Engineering",
      status: "ACTIVE" as const,
    },
    {
      firstName: "Jane",
      lastName: "Smith",
      email: "jane.smith@askworx.com",
      phone: "+1 555 100 0002",
      role: "STAFF" as const,
      department: "Design",
      status: "ACTIVE" as const,
    },
    {
      firstName: "Michael",
      lastName: "Brown",
      email: "michael.brown@askworx.com",
      phone: "+1 555 100 0003",
      role: "STAFF" as const,
      department: "Marketing",
      status: "ACTIVE" as const,
    },
    {
      firstName: "Priya",
      lastName: "Nair",
      email: "priya.nair@askworx.com",
      phone: "+1 555 100 0004",
      role: "ADMIN" as const,
      department: "Operations",
      status: "ACTIVE" as const,
    },
    {
      firstName: "Carlos",
      lastName: "Mendez",
      email: "carlos.mendez@askworx.com",
      phone: "+1 555 100 0005",
      role: "STAFF" as const,
      department: "Sales",
      status: "INACTIVE" as const,
    },
  ];

  const created: string[] = [];
  const skipped: string[] = [];

  for (const member of demoStaff) {
    const existing = await prisma.staff.findUnique({ where: { email: member.email } });
    if (existing) {
      skipped.push(`${member.firstName} ${member.lastName}`);
    } else {
      await prisma.staff.create({ data: member });
      created.push(`${member.firstName} ${member.lastName}`);
    }
  }

  return NextResponse.json({
    message: "Staff seed complete",
    created,
    skipped,
  });
}
