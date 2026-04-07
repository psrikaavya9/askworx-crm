/**
 * seed-projects.ts
 *
 * Idempotent seed script that:
 *   1. Ensures 10+ leads exist with stage = WON
 *   2. Creates 15 projects linked to real clients (from WON leads' clientId)
 *   3. Creates 3–5 tasks per project with varied statuses and assigned staff
 *
 * Run: npx tsx prisma/seed-projects.ts
 */

import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new (PrismaClient as any)({ adapter }) as PrismaClient;

// ─── helpers ───────────────────────────────────────────────────────────────

const daysAgo   = (n: number) => new Date(Date.now() - n * 86_400_000);
const daysAhead = (n: number) => new Date(Date.now() + n * 86_400_000);

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── PROJECT DEFINITIONS ───────────────────────────────────────────────────

const PROJECT_TEMPLATES = [
  {
    name: "CRM Implementation",
    description: "Full CRM platform implementation including data migration, staff training, and go-live support.",
    status: "ACTIVE" as const,
    startOffset: -30, deadlineOffset: 60,
    tasks: [
      { title: "Requirement gathering & scoping",  status: "DONE" as const,        priority: "HIGH" as const,   daysOffset: -25 },
      { title: "Data migration planning",          status: "DONE" as const,        priority: "HIGH" as const,   daysOffset: -15 },
      { title: "System configuration",             status: "IN_PROGRESS" as const, priority: "HIGH" as const,   daysOffset: 10  },
      { title: "Staff training sessions",          status: "TODO" as const,        priority: "MEDIUM" as const, daysOffset: 35  },
      { title: "Go-live & hypercare support",      status: "TODO" as const,        priority: "HIGH" as const,   daysOffset: 55  },
    ],
  },
  {
    name: "Website Redesign Project",
    description: "Complete redesign of company website — modern UI, SEO optimisation, mobile-first responsive layout.",
    status: "ACTIVE" as const,
    startOffset: -45, deadlineOffset: 30,
    tasks: [
      { title: "Discovery & wireframes",           status: "DONE" as const,        priority: "HIGH" as const,   daysOffset: -40 },
      { title: "UI design mockups (5 pages)",      status: "DONE" as const,        priority: "HIGH" as const,   daysOffset: -20 },
      { title: "Frontend development",             status: "IN_PROGRESS" as const, priority: "HIGH" as const,   daysOffset: 10  },
      { title: "SEO & performance audit",          status: "TODO" as const,        priority: "MEDIUM" as const, daysOffset: 25  },
      { title: "Launch & DNS migration",           status: "TODO" as const,        priority: "HIGH" as const,   daysOffset: 30  },
    ],
  },
  {
    name: "Mobile App Development",
    description: "Cross-platform mobile app for iOS & Android with offline capabilities and push notifications.",
    status: "ACTIVE" as const,
    startOffset: -20, deadlineOffset: 90,
    tasks: [
      { title: "UX flow design",                   status: "DONE" as const,        priority: "HIGH" as const,   daysOffset: -15 },
      { title: "Authentication & user management", status: "DONE" as const,        priority: "HIGH" as const,   daysOffset: -5  },
      { title: "Core feature modules",             status: "IN_PROGRESS" as const, priority: "HIGH" as const,   daysOffset: 30  },
      { title: "Offline sync & caching",           status: "TODO" as const,        priority: "MEDIUM" as const, daysOffset: 60  },
      { title: "App Store submission",             status: "TODO" as const,        priority: "LOW" as const,    daysOffset: 85  },
    ],
  },
  {
    name: "ERP Integration",
    description: "Integrate existing ERP system with CRM — data mapping, API connectors, and end-to-end testing.",
    status: "ON_HOLD" as const,
    startOffset: -10, deadlineOffset: 120,
    tasks: [
      { title: "Stakeholder alignment meeting",    status: "DONE" as const,        priority: "HIGH" as const,   daysOffset: -8  },
      { title: "Data schema mapping",              status: "IN_PROGRESS" as const, priority: "HIGH" as const,   daysOffset: 20  },
      { title: "API connector development",        status: "TODO" as const,        priority: "HIGH" as const,   daysOffset: 70  },
      { title: "UAT & user sign-off",              status: "TODO" as const,        priority: "MEDIUM" as const, daysOffset: 110 },
    ],
  },
  {
    name: "Annual Marketing Campaign",
    description: "Q2 digital marketing campaign — social media, email sequences, and paid ads across three channels.",
    status: "COMPLETED" as const,
    startOffset: -90, deadlineOffset: -15,
    tasks: [
      { title: "Campaign strategy & brief",        status: "DONE" as const, priority: "HIGH" as const,   daysOffset: -85 },
      { title: "Creative assets production",       status: "DONE" as const, priority: "HIGH" as const,   daysOffset: -60 },
      { title: "Ad campaign setup & launch",       status: "DONE" as const, priority: "HIGH" as const,   daysOffset: -40 },
      { title: "Weekly performance review",        status: "DONE" as const, priority: "MEDIUM" as const, daysOffset: -20 },
      { title: "Campaign closure & report",        status: "DONE" as const, priority: "LOW" as const,    daysOffset: -16 },
    ],
  },
  {
    name: "Inventory Management System",
    description: "Implement stock tracking, reorder automation, and supplier management module.",
    status: "ACTIVE" as const,
    startOffset: -15, deadlineOffset: 75,
    tasks: [
      { title: "Product catalogue import",         status: "DONE" as const,        priority: "HIGH" as const,   daysOffset: -12 },
      { title: "Stock movement tracking module",   status: "IN_PROGRESS" as const, priority: "HIGH" as const,   daysOffset: 15  },
      { title: "Reorder alert configuration",      status: "TODO" as const,        priority: "MEDIUM" as const, daysOffset: 40  },
      { title: "Supplier portal integration",      status: "TODO" as const,        priority: "LOW" as const,    daysOffset: 70  },
    ],
  },
  {
    name: "HR Onboarding Portal",
    description: "Digital onboarding portal with document vault, training videos, and quiz-based certification.",
    status: "COMPLETED" as const,
    startOffset: -120, deadlineOffset: -30,
    tasks: [
      { title: "Portal architecture design",       status: "DONE" as const, priority: "HIGH" as const,   daysOffset: -115 },
      { title: "Document upload & versioning",     status: "DONE" as const, priority: "HIGH" as const,   daysOffset: -90  },
      { title: "Training video module",            status: "DONE" as const, priority: "MEDIUM" as const, daysOffset: -60  },
      { title: "Quiz & certification system",      status: "DONE" as const, priority: "MEDIUM" as const, daysOffset: -40  },
      { title: "UAT with HR team",                 status: "DONE" as const, priority: "HIGH" as const,   daysOffset: -32  },
    ],
  },
  {
    name: "Customer Support Chatbot",
    description: "AI-powered customer support bot integrated with WhatsApp and website live chat.",
    status: "ACTIVE" as const,
    startOffset: -5, deadlineOffset: 100,
    tasks: [
      { title: "Intent mapping & FAQ corpus",      status: "DONE" as const,        priority: "HIGH" as const,   daysOffset: -3  },
      { title: "Chatbot flow development",         status: "IN_PROGRESS" as const, priority: "HIGH" as const,   daysOffset: 25  },
      { title: "WhatsApp API integration",         status: "TODO" as const,        priority: "HIGH" as const,   daysOffset: 55  },
      { title: "QA & accuracy tuning",             status: "TODO" as const,        priority: "MEDIUM" as const, daysOffset: 90  },
    ],
  },
  {
    name: "E-Commerce Platform",
    description: "Full e-commerce site with payment gateway, order management, and customer dashboard.",
    status: "ACTIVE" as const,
    startOffset: -60, deadlineOffset: -5,
    tasks: [
      { title: "Product catalogue setup",          status: "DONE" as const,        priority: "HIGH" as const,   daysOffset: -55 },
      { title: "Payment gateway integration",      status: "DONE" as const,        priority: "HIGH" as const,   daysOffset: -30 },
      { title: "Order management module",          status: "IN_PROGRESS" as const, priority: "HIGH" as const,   daysOffset: -8  },
      { title: "Load testing & optimisation",      status: "TODO" as const,        priority: "MEDIUM" as const, daysOffset: -6  },
      { title: "Go-live checklist",                status: "TODO" as const,        priority: "HIGH" as const,   daysOffset: -5  },
    ],
  },
  {
    name: "Data Analytics Dashboard",
    description: "Business intelligence dashboard pulling from CRM, finance, and ops data for C-level reporting.",
    status: "PLANNING" as const,
    startOffset: 7, deadlineOffset: 100,
    tasks: [
      { title: "Stakeholder requirements workshop", status: "TODO" as const, priority: "HIGH" as const,   daysOffset: 10 },
      { title: "Data source mapping",               status: "TODO" as const, priority: "HIGH" as const,   daysOffset: 25 },
      { title: "Dashboard prototype (Figma)",       status: "TODO" as const, priority: "MEDIUM" as const, daysOffset: 55 },
      { title: "Backend data pipeline build",       status: "TODO" as const, priority: "HIGH" as const,   daysOffset: 80 },
      { title: "UAT & report sign-off",             status: "TODO" as const, priority: "MEDIUM" as const, daysOffset: 95 },
    ],
  },
  {
    name: "Compliance Audit Automation",
    description: "Automate statutory compliance tracking, document expiry alerts, and audit trail generation.",
    status: "ACTIVE" as const,
    startOffset: -25, deadlineOffset: 50,
    tasks: [
      { title: "Compliance item cataloguing",      status: "DONE" as const,        priority: "HIGH" as const,   daysOffset: -22 },
      { title: "Automated alert engine",           status: "IN_PROGRESS" as const, priority: "HIGH" as const,   daysOffset: 5   },
      { title: "Document expiry tracking",         status: "IN_PROGRESS" as const, priority: "MEDIUM" as const, daysOffset: 20  },
      { title: "Audit report generation",          status: "TODO" as const,        priority: "MEDIUM" as const, daysOffset: 45  },
    ],
  },
  {
    name: "Field Sales App",
    description: "Mobile app for field sales reps — GPS check-in, visit logging, expense submission, and lead updates.",
    status: "COMPLETED" as const,
    startOffset: -150, deadlineOffset: -60,
    tasks: [
      { title: "GPS attendance module",            status: "DONE" as const, priority: "HIGH" as const,   daysOffset: -145 },
      { title: "Visit logging with photo upload",  status: "DONE" as const, priority: "HIGH" as const,   daysOffset: -120 },
      { title: "Expense submission workflow",      status: "DONE" as const, priority: "HIGH" as const,   daysOffset: -100 },
      { title: "Lead update from field",           status: "DONE" as const, priority: "MEDIUM" as const, daysOffset: -80  },
      { title: "Beta testing with 5 reps",         status: "DONE" as const, priority: "HIGH" as const,   daysOffset: -65  },
    ],
  },
  {
    name: "Payment Gateway Integration",
    description: "Integrate Razorpay and UPI payment gateways into the billing system with auto-reconciliation.",
    status: "ACTIVE" as const,
    startOffset: -8, deadlineOffset: 45,
    tasks: [
      { title: "Gateway selection & contracts",    status: "DONE" as const,        priority: "HIGH" as const,   daysOffset: -6  },
      { title: "Sandbox API integration",          status: "DONE" as const,        priority: "HIGH" as const,   daysOffset: -2  },
      { title: "Production integration",           status: "IN_PROGRESS" as const, priority: "HIGH" as const,   daysOffset: 15  },
      { title: "Auto-reconciliation module",       status: "TODO" as const,        priority: "HIGH" as const,   daysOffset: 35  },
      { title: "Finance team training",            status: "TODO" as const,        priority: "LOW" as const,    daysOffset: 43  },
    ],
  },
  {
    name: "Sales Training Programme",
    description: "Digital training programme for the sales team — video modules, quizzes, and certification.",
    status: "ON_HOLD" as const,
    startOffset: -3, deadlineOffset: 90,
    tasks: [
      { title: "Training content outline",         status: "DONE" as const,        priority: "MEDIUM" as const, daysOffset: -1  },
      { title: "Video module production",          status: "TODO" as const,        priority: "HIGH" as const,   daysOffset: 30  },
      { title: "Quiz design per module",           status: "TODO" as const,        priority: "MEDIUM" as const, daysOffset: 55  },
      { title: "LMS platform setup",               status: "TODO" as const,        priority: "HIGH" as const,   daysOffset: 80  },
    ],
  },
  {
    name: "Security Audit & Hardening",
    description: "Penetration testing, VAPT report, and remediation of findings across the CRM/ERP stack.",
    status: "ACTIVE" as const,
    startOffset: -12, deadlineOffset: 40,
    tasks: [
      { title: "Scope definition & kickoff",       status: "DONE" as const,        priority: "HIGH" as const,   daysOffset: -10 },
      { title: "Automated vulnerability scan",     status: "DONE" as const,        priority: "HIGH" as const,   daysOffset: -5  },
      { title: "Manual penetration testing",       status: "IN_PROGRESS" as const, priority: "HIGH" as const,   daysOffset: 10  },
      { title: "VAPT report & risk register",      status: "TODO" as const,        priority: "HIGH" as const,   daysOffset: 25  },
      { title: "Remediation & retest",             status: "TODO" as const,        priority: "HIGH" as const,   daysOffset: 38  },
    ],
  },
];

// ─── MAIN ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🚀 seed-projects: starting...\n");

  // ── STEP 1: Ensure 10+ WON leads ────────────────────────────────────────
  console.log("🎯 Step 1: Ensuring 10+ WON leads...");

  const existingWon = await prisma.lead.count({ where: { stage: "WON" } });
  console.log(`   Currently ${existingWon} WON leads`);

  if (existingWon < 10) {
    const needed = 10 - existingWon;
    console.log(`   Creating ${needed} additional WON leads...`);

    // Get some clients to link these leads to
    const clients = await prisma.client.findMany({ select: { id: true, company: true }, take: 20 });
    const staff   = await prisma.staff.findMany({ select: { id: true }, take: 10 });

    const wonReasons = [
      "Best price in market", "Strong relationship with decision maker",
      "Product fit was excellent", "Referral from existing client",
      "Fastest implementation timeline", "Best support package offered",
      "Unique feature advantage", "Previous successful engagement",
    ];

    for (let i = 0; i < needed; i++) {
      const firstName = pick(["Arjun","Rahul","Priya","Amit","Neha","Vikram","Pooja","Aditya","Riya","Karan"]);
      const lastName  = pick(["Sharma","Patel","Verma","Gupta","Singh","Mehta","Kumar","Shah","Joshi","Rao"]);
      const client    = clients[i % clients.length];

      await prisma.lead.create({
        data: {
          firstName,
          lastName,
          email:       `won.lead.${firstName.toLowerCase()}${i}@${pick(["techcorp.in","bizgroup.com","enterprise.io","solutions.co.in"])}`,
          phone:       `+91 98${String(rand(10000000, 99999999))}`,
          company:     client?.company ?? `Enterprise ${i + 1}`,
          jobTitle:    pick(["CEO","Director","VP Operations","Head of IT","Purchase Manager"]),
          source:      pick(["REFERRAL","WEBSITE","COLD_CALL","TRADE_SHOW","PARTNER"]),
          stage:       "WON",
          priority:    pick(["HIGH","MEDIUM"]),
          dealValue:   rand(50000, 500000),
          currency:    "INR",
          industry:    pick(["Technology","Finance","Healthcare","Manufacturing","Retail","Logistics"]),
          companySize: pick(["MEDIUM","LARGE","ENTERPRISE"]),
          clientId:    client?.id ?? null,
          assignedTo:  staff[i % staff.length]?.id ?? null,
          winReason:   pick(wonReasons),
          convertedAt: daysAgo(rand(5, 45)),
          lastActivityAt: daysAgo(rand(1, 10)),
          createdAt:   daysAgo(rand(30, 90)),
        },
      });
    }
    console.log(`   ✅ Created ${needed} WON leads`);
  } else {
    console.log(`   ✅ Already have ${existingWon} WON leads — skipping`);
  }

  // ── STEP 2: Gather clients from WON leads ───────────────────────────────
  console.log("\n🏢 Step 2: Collecting clients from WON leads...");

  const wonLeads = await prisma.lead.findMany({
    where: { stage: "WON", clientId: { not: null } },
    select: { clientId: true },
    take: 20,
  });

  // Fallback: if WON leads aren't linked to clients, use any available clients
  let clientPool: string[] = wonLeads
    .map((l) => l.clientId!)
    .filter((id, idx, arr) => arr.indexOf(id) === idx); // dedupe

  if (clientPool.length < 10) {
    const extraClients = await prisma.client.findMany({
      select: { id: true },
      take: 20,
    });
    const extraIds = extraClients.map((c) => c.id).filter((id) => !clientPool.includes(id));
    clientPool = [...clientPool, ...extraIds];
  }

  console.log(`   ✅ ${clientPool.length} clients available for project linking`);

  // ── STEP 3: Get staff for task assignment ───────────────────────────────
  const staffList = await prisma.staff.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, firstName: true, lastName: true },
    take: 15,
  });

  if (staffList.length === 0) {
    console.error("❌ No active staff found. Run the main seed first.");
    process.exit(1);
  }

  const staffIds = staffList.map((s) => s.id);

  // ── STEP 4: Create projects ─────────────────────────────────────────────
  console.log("\n📂 Step 3: Creating 15 projects with tasks...");

  // Check which projects already exist
  const existingNames = new Set(
    (await prisma.project.findMany({ select: { name: true } })).map((p) => p.name)
  );

  let projectsCreated = 0;
  let tasksCreated    = 0;
  let skipped         = 0;

  for (let idx = 0; idx < PROJECT_TEMPLATES.length; idx++) {
    const def = PROJECT_TEMPLATES[idx];

    if (existingNames.has(def.name)) {
      console.log(`   ⏭  Skipping "${def.name}" — already exists`);
      skipped++;
      continue;
    }

    const clientId = clientPool[idx % clientPool.length] ?? null;

    const project = await prisma.project.create({
      data: {
        name:        def.name,
        description: def.description,
        startDate:   new Date(Date.now() + def.startOffset * 86_400_000),
        deadline:    new Date(Date.now() + def.deadlineOffset * 86_400_000),
        status:      def.status,
        clientId:    clientId,
      },
    });

    // Create tasks
    for (const task of def.tasks) {
      // Assign 1–2 staff members
      const assignCount = rand(1, 2);
      const assigned    = staffIds
        .slice(idx % staffIds.length, (idx % staffIds.length) + assignCount)
        .concat(staffIds.slice(0, Math.max(0, assignCount - (staffIds.length - idx % staffIds.length))));

      const hoursMap: Record<string, number> = { DONE: rand(2, 12), IN_PROGRESS: rand(1, 6), TODO: 0 };

      await prisma.task.create({
        data: {
          projectId:    project.id,
          title:        task.title,
          status:       task.status,
          priority:     task.priority,
          dueDate:      new Date(Date.now() + task.daysOffset * 86_400_000),
          assignedStaff: assigned,
          hoursLogged:  hoursMap[task.status] ?? 0,
        },
      });
      tasksCreated++;
    }

    projectsCreated++;
    const clientName = clientId
      ? `client ${clientId.slice(0, 8)}...`
      : "no client";
    console.log(`   ✅ "${def.name}" [${def.status}] → ${clientName} (${def.tasks.length} tasks)`);
  }

  // ── SUMMARY ────────────────────────────────────────────────────────────
  console.log("\n─────────────────────────────────────");
  console.log(`✅ Projects created : ${projectsCreated}`);
  console.log(`✅ Tasks created    : ${tasksCreated}`);
  console.log(`⏭  Projects skipped : ${skipped}`);

  const totalProjects = await prisma.project.count();
  const totalTasks    = await prisma.task.count();
  const totalWon      = await prisma.lead.count({ where: { stage: "WON" } });

  console.log(`\n📊 Database totals:`);
  console.log(`   Projects  : ${totalProjects}`);
  console.log(`   Tasks     : ${totalTasks}`);
  console.log(`   WON leads : ${totalWon}`);
  console.log("\n🎉 seed-projects done!\n");
}

main()
  .catch((e) => {
    console.error("❌ seed-projects failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
