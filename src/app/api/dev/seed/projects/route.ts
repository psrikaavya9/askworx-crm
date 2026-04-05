import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/dev/seed/projects
 * Seeds 5 test projects (with tasks) covering all project statuses.
 * Idempotent — skips if these projects already exist.
 */
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const now = new Date();
  const daysAgo  = (n: number) => new Date(now.getTime() - n * 86400_000);
  const daysAhead = (n: number) => new Date(now.getTime() + n * 86400_000);

  const projectDefs = [
    // 1 — ACTIVE, linked to a client (if one exists)
    {
      name: "Mobile App Development",
      description:
        "Build a cross-platform mobile app for iOS and Android. Covers UI design, API integration, and App Store publishing.",
      startDate: daysAgo(30),
      deadline: daysAhead(60),
      status: "ACTIVE" as const,
      tasks: [
        { title: "UI/UX Wireframes",         status: "DONE"        as const, priority: "HIGH"   as const, dueDate: daysAgo(20),  assignedStaff: ["Aisha"] },
        { title: "Authentication module",    status: "DONE"        as const, priority: "HIGH"   as const, dueDate: daysAgo(10),  assignedStaff: ["Carlos"] },
        { title: "Home screen implementation", status: "IN_PROGRESS" as const, priority: "HIGH"   as const, dueDate: daysAhead(5),  assignedStaff: ["Aisha", "Carlos"] },
        { title: "Push notifications setup", status: "TODO"        as const, priority: "MEDIUM" as const, dueDate: daysAhead(20), assignedStaff: ["Carlos"] },
        { title: "App Store submission",     status: "TODO"        as const, priority: "LOW"    as const, dueDate: daysAhead(55), assignedStaff: ["Aisha"] },
      ],
    },
    // 2 — PLANNING, no client
    {
      name: "Brand Identity Refresh",
      description:
        "Complete brand overhaul including new logo, color palette, typography guidelines, and brand usage documentation.",
      startDate: daysAhead(7),
      deadline: daysAhead(90),
      status: "PLANNING" as const,
      tasks: [
        { title: "Brand audit",              status: "TODO" as const, priority: "HIGH"   as const, dueDate: daysAhead(14), assignedStaff: ["Sam"] },
        { title: "Competitor analysis",      status: "TODO" as const, priority: "MEDIUM" as const, dueDate: daysAhead(21), assignedStaff: ["Sam"] },
        { title: "Logo concepts (3 options)",status: "TODO" as const, priority: "HIGH"   as const, dueDate: daysAhead(40), assignedStaff: ["Sam", "Taylor"] },
        { title: "Brand guidelines doc",     status: "TODO" as const, priority: "MEDIUM" as const, dueDate: daysAhead(80), assignedStaff: ["Taylor"] },
      ],
    },
    // 3 — COMPLETED, past deadline
    {
      name: "Annual Report 2025",
      description:
        "Design and produce the FY2025 annual report for shareholders — covering financial summaries, infographics, and executive commentary.",
      startDate: daysAgo(90),
      deadline: daysAgo(15),
      status: "COMPLETED" as const,
      tasks: [
        { title: "Financial data collection", status: "DONE" as const, priority: "HIGH"   as const, dueDate: daysAgo(75), assignedStaff: ["Jordan"] },
        { title: "Infographic design",        status: "DONE" as const, priority: "MEDIUM" as const, dueDate: daysAgo(45), assignedStaff: ["Jordan", "Alex"] },
        { title: "Executive review round",    status: "DONE" as const, priority: "HIGH"   as const, dueDate: daysAgo(25), assignedStaff: ["Alex"] },
        { title: "Print & distribution",      status: "DONE" as const, priority: "LOW"    as const, dueDate: daysAgo(15), assignedStaff: ["Jordan"] },
      ],
    },
    // 4 — ON_HOLD, future deadline
    {
      name: "ERP System Integration",
      description:
        "Integrate the existing ERP with the new CRM platform. Includes data migration, API mapping, and UAT testing.",
      startDate: daysAgo(10),
      deadline: daysAhead(120),
      status: "ON_HOLD" as const,
      tasks: [
        { title: "Requirement gathering",    status: "DONE"        as const, priority: "HIGH"   as const, dueDate: daysAgo(5),   assignedStaff: ["Morgan"] },
        { title: "Data schema mapping",      status: "IN_PROGRESS" as const, priority: "HIGH"   as const, dueDate: daysAhead(30), assignedStaff: ["Morgan", "Riley"] },
        { title: "API connector build",      status: "TODO"        as const, priority: "HIGH"   as const, dueDate: daysAhead(70), assignedStaff: ["Riley"] },
        { title: "UAT & sign-off",           status: "TODO"        as const, priority: "MEDIUM" as const, dueDate: daysAhead(110), assignedStaff: ["Morgan"] },
      ],
    },
    // 5 — ACTIVE, overdue deadline (deadline in the past, status still ACTIVE → shows as overdue)
    {
      name: "E-commerce Platform Launch",
      description:
        "Launch a fully functional e-commerce site with payment gateway, inventory sync, and order management system.",
      startDate: daysAgo(60),
      deadline: daysAgo(5),
      status: "ACTIVE" as const,
      tasks: [
        { title: "Product catalogue import",  status: "DONE"        as const, priority: "HIGH"   as const, dueDate: daysAgo(40), assignedStaff: ["Casey"] },
        { title: "Payment gateway integration", status: "DONE"      as const, priority: "HIGH"   as const, dueDate: daysAgo(20), assignedStaff: ["Casey", "Drew"] },
        { title: "Order management module",   status: "IN_PROGRESS" as const, priority: "HIGH"   as const, dueDate: daysAgo(8),  assignedStaff: ["Drew"] },
        { title: "Performance & load testing",status: "TODO"        as const, priority: "MEDIUM" as const, dueDate: daysAgo(3),  assignedStaff: ["Casey"] },
        { title: "Go-live & monitoring",      status: "TODO"        as const, priority: "HIGH"   as const, dueDate: daysAgo(1),  assignedStaff: ["Casey", "Drew"] },
      ],
    },
  ];

  // Check idempotency — skip any project whose name already exists
  const existingNames = await prisma.project.findMany({
    where: { name: { in: projectDefs.map((p) => p.name) } },
    select: { name: true },
  });
  const alreadySeeded = new Set(existingNames.map((p) => p.name));

  const toCreate = projectDefs.filter((p) => !alreadySeeded.has(p.name));

  if (toCreate.length === 0) {
    return NextResponse.json({
      message: "Test projects already seeded",
      skipped: alreadySeeded.size,
    });
  }

  // Optionally link the first ACTIVE project to the first available client
  const firstClient = await prisma.client.findFirst({ select: { id: true } });

  const created: { name: string; id: string; tasks: number }[] = [];

  for (const def of toCreate) {
    const clientId =
      def.status === "ACTIVE" && def.name === "Mobile App Development" && firstClient
        ? firstClient.id
        : undefined;

    const project = await prisma.project.create({
      data: {
        name: def.name,
        description: def.description,
        startDate: def.startDate,
        deadline: def.deadline,
        status: def.status,
        ...(clientId && { clientId }),
      },
    });

    for (const task of def.tasks) {
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

    created.push({ name: project.name, id: project.id, tasks: def.tasks.length });
  }

  return NextResponse.json({
    message: `Seeded ${created.length} test project(s)`,
    projects: created,
    skipped: alreadySeeded.size,
  });
}
