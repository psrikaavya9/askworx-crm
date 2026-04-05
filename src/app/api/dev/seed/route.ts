import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/dev/seed
 * Creates the demo "Website Redesign" project with sample tasks.
 * Idempotent — will not create duplicates if already seeded.
 */
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const existing = await prisma.project.findFirst({
    where: { name: "Website Redesign" },
  });

  if (existing) {
    return NextResponse.json({ message: "Demo data already exists", projectId: existing.id });
  }

  const project = await prisma.project.create({
    data: {
      name: "Website Redesign",
      description:
        "Complete redesign of the company website with a modern look, improved UX, and mobile-first approach.",
      startDate: new Date("2026-02-01"),
      deadline: new Date("2026-04-30"),
      status: "ACTIVE",
    },
  });

  const taskDefs = [
    // TODO
    {
      title: "Design brief",
      status: "TODO" as const,
      priority: "HIGH" as const,
      dueDate: new Date("2026-03-20"),
      assignedStaff: ["Alice"],
    },
    {
      title: "Content plan",
      status: "TODO" as const,
      priority: "MEDIUM" as const,
      dueDate: new Date("2026-03-25"),
      assignedStaff: ["Bob"],
    },
    // IN_PROGRESS
    {
      title: "Website dev",
      status: "IN_PROGRESS" as const,
      priority: "HIGH" as const,
      dueDate: new Date("2026-04-15"),
      assignedStaff: ["Charlie", "Dave"],
    },
    {
      title: "SEO setup",
      status: "IN_PROGRESS" as const,
      priority: "MEDIUM" as const,
      dueDate: new Date("2026-04-20"),
      assignedStaff: ["Eve"],
    },
    // DONE
    {
      title: "Logo design",
      status: "DONE" as const,
      priority: "HIGH" as const,
      dueDate: new Date("2026-02-28"),
      assignedStaff: ["Alice"],
    },
    {
      title: "Proposal",
      status: "DONE" as const,
      priority: "MEDIUM" as const,
      dueDate: new Date("2026-02-15"),
      assignedStaff: ["Bob"],
    },
  ];

  for (const task of taskDefs) {
    await prisma.task.create({
      data: {
        projectId: project.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        assignedStaff: task.assignedStaff,
        hoursLogged: 0,
      },
    });
  }

  return NextResponse.json({
    message: "Demo data created successfully",
    projectId: project.id,
    tasks: taskDefs.length,
  });
}
