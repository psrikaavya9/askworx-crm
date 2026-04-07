/**
 * seed-health.ts
 *
 * Idempotent health score seed:
 *   1. Creates invoices (PAID / SENT / OVERDUE mix) per client
 *   2. Creates active Projects per client
 *   3. Creates recent CustomerInteractions per client (if needed)
 *   4. Inline-computes and persists CustomerHealthScore for every client
 *
 * Profiles (cycled across clients for realistic score distribution):
 *   A — Healthy  (80+): 2 paid invoices · 2 active projects · 3 recent interactions · no complaints
 *   B — Stable   (60+): 1 paid + 1 sent · 1 active project · 1 interaction 10 days ago
 *   C — At Risk  (40+): 1 paid + 1 overdue · no active project · 1 old interaction (45 days ago)
 *   D — Critical (<40): 2 overdue invoices · no projects · no interactions
 *
 * Run: npx tsx --tsconfig tsconfig.seed.json prisma/seed-health.ts
 */

import "dotenv/config";
import { Pool }         from "pg";
import { PrismaPg }    from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const pool    = new Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma  = new (PrismaClient as any)({ adapter }) as PrismaClient;

const daysAgo   = (n: number) => new Date(Date.now() - n * 86_400_000);
const daysAhead = (n: number) => new Date(Date.now() + n * 86_400_000);

// ---------------------------------------------------------------------------
// Inline health score computation (mirrors lib/services/healthScore.ts)
// ---------------------------------------------------------------------------

function scorePayment(total: number, overdue: number): number {
  if (total === 0) return 50;
  const r = overdue / total;
  if (r === 0)     return 100;
  if (r <= 0.10)   return 80;
  if (r <= 0.25)   return 60;
  if (r <= 0.50)   return 35;
  return 10;
}
function scoreEngagement(active: number): number {
  if (active === 0) return 10; if (active === 1) return 65;
  if (active === 2) return 85; return 100;
}
function scoreInteraction(latestDate: Date | null): number {
  if (!latestDate) return 0;
  const d = (Date.now() - latestDate.getTime()) / 86_400_000;
  if (d <=  7) return 100; if (d <= 14) return 85;
  if (d <= 30) return 70;  if (d <= 60) return 40;
  if (d <= 90) return 20;  return 0;
}
function scoreComplaint(open: number): number {
  if (open === 0) return 100; if (open === 1) return 65;
  if (open === 2) return 40;  if (open === 3) return 20; return 0;
}
function scoreRevenue(total: number): number {
  if (total <= 0)          return 10;
  if (total < 50_000)      return 25;
  if (total < 200_000)     return 45;
  if (total < 500_000)     return 65;
  if (total < 2_000_000)   return 80;
  return 100;
}

async function computeAndPersistScore(clientId: string): Promise<number> {
  const [totalInvoices, overdueInvoices, activeProjects, latestInteraction, openComplaints, billingAgg] =
    await Promise.all([
      prisma.invoice.count({ where: { clientId } }),
      prisma.invoice.count({ where: { clientId, status: "OVERDUE" } }),
      prisma.project.count({ where: { clientId, status: "ACTIVE" } }),
      prisma.customerInteraction.findFirst({
        where:   { clientId, approved: true, rejected: false },
        orderBy: { date: "desc" },
        select:  { date: true },
      }),
      prisma.complaint.count({ where: { clientId, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
      prisma.invoice.aggregate({ where: { clientId }, _sum: { totalAmount: true } }),
    ]);

  const payment     = Math.min(100, Math.max(0, Math.round(scorePayment(totalInvoices, overdueInvoices))));
  const engagement  = Math.min(100, Math.max(0, Math.round(scoreEngagement(activeProjects))));
  const interaction = Math.min(100, Math.max(0, Math.round(scoreInteraction(latestInteraction?.date ?? null))));
  const complaint   = Math.min(100, Math.max(0, Math.round(scoreComplaint(openComplaints))));
  const revenue     = Math.min(100, Math.max(0, Math.round(scoreRevenue(Number(billingAgg._sum.totalAmount ?? 0)))));

  const score = Math.min(100, Math.max(0, Math.round(
    payment * 0.30 + engagement * 0.25 + interaction * 0.20 + complaint * 0.15 + revenue * 0.10
  )));

  await prisma.customerHealthScore.create({
    data: {
      clientId,
      score,
      paymentScore:     payment,
      engagementScore:  engagement,
      interactionScore: interaction,
      complaintScore:   complaint,
      revenueScore:     revenue,
    },
  });

  return score;
}

// ---------------------------------------------------------------------------
// Profile data factories
// ---------------------------------------------------------------------------

let invCounter = 1000;
function nextInvNumber() { return `INV-SEED-${String(++invCounter).padStart(4, "0")}`; }

type Profile = "A" | "B" | "C" | "D";

async function seedInvoices(clientId: string, profile: Profile) {
  const existing = await prisma.invoice.count({ where: { clientId } });
  if (existing > 0) return; // already has invoices

  if (profile === "A") {
    // 2 PAID — excellent payment history
    for (const [amt, daysIssuedAgo] of [[850000, 60], [1250000, 30]] as [number, number][]) {
      const inv = await prisma.invoice.create({ data: {
        invoiceNumber: nextInvNumber(), clientId,
        issueDate: daysAgo(daysIssuedAgo), dueDate: daysAgo(daysIssuedAgo - 30),
        subtotal: amt, totalAmount: amt, status: "PAID",
      }});
      await prisma.payment.create({ data: {
        invoiceId: inv.id, amount: amt,
        paymentDate: daysAgo(daysIssuedAgo - 25), paymentMethod: "BANK",
      }});
    }
  } else if (profile === "B") {
    // 1 PAID + 1 SENT
    const paid = await prisma.invoice.create({ data: {
      invoiceNumber: nextInvNumber(), clientId,
      issueDate: daysAgo(45), dueDate: daysAgo(15),
      subtotal: 480000, totalAmount: 480000, status: "PAID",
    }});
    await prisma.payment.create({ data: {
      invoiceId: paid.id, amount: 480000,
      paymentDate: daysAgo(20), paymentMethod: "UPI",
    }});
    await prisma.invoice.create({ data: {
      invoiceNumber: nextInvNumber(), clientId,
      issueDate: daysAgo(15), dueDate: daysAhead(15),
      subtotal: 320000, totalAmount: 320000, status: "SENT",
    }});
  } else if (profile === "C") {
    // 1 PAID + 1 OVERDUE
    const paid = await prisma.invoice.create({ data: {
      invoiceNumber: nextInvNumber(), clientId,
      issueDate: daysAgo(90), dueDate: daysAgo(60),
      subtotal: 180000, totalAmount: 180000, status: "PAID",
    }});
    await prisma.payment.create({ data: {
      invoiceId: paid.id, amount: 180000,
      paymentDate: daysAgo(55), paymentMethod: "CASH",
    }});
    await prisma.invoice.create({ data: {
      invoiceNumber: nextInvNumber(), clientId,
      issueDate: daysAgo(60), dueDate: daysAgo(30),
      subtotal: 240000, totalAmount: 240000, status: "OVERDUE",
    }});
  } else {
    // D — 2 OVERDUE
    await prisma.invoice.create({ data: {
      invoiceNumber: nextInvNumber(), clientId,
      issueDate: daysAgo(90), dueDate: daysAgo(60),
      subtotal: 150000, totalAmount: 150000, status: "OVERDUE",
    }});
    await prisma.invoice.create({ data: {
      invoiceNumber: nextInvNumber(), clientId,
      issueDate: daysAgo(60), dueDate: daysAgo(30),
      subtotal: 200000, totalAmount: 200000, status: "OVERDUE",
    }});
  }
}

async function seedProject(clientId: string, profile: Profile) {
  const existing = await prisma.project.count({ where: { clientId } });
  if (existing > 0) return;

  if (profile === "A") {
    // 2 ACTIVE projects
    await prisma.project.create({ data: {
      name: "ASKworX Platform Integration", clientId, status: "ACTIVE",
      startDate: daysAgo(60), deadline: daysAhead(90),
      description: "Full CRM + ERP integration project",
    }});
    await prisma.project.create({ data: {
      name: "Analytics Dashboard Rollout", clientId, status: "ACTIVE",
      startDate: daysAgo(30), deadline: daysAhead(60),
      description: "Business analytics dashboard setup",
    }});
  } else if (profile === "B") {
    // 1 ACTIVE project
    await prisma.project.create({ data: {
      name: "CRM Onboarding Project", clientId, status: "ACTIVE",
      startDate: daysAgo(45), deadline: daysAhead(30),
      description: "Client onboarding and training",
    }});
  } else if (profile === "C") {
    // 1 COMPLETED project (no active)
    await prisma.project.create({ data: {
      name: "Initial Setup", clientId, status: "COMPLETED",
      startDate: daysAgo(120), deadline: daysAgo(60),
    }});
  }
  // D: no projects
}

async function seedInteractions(clientId: string, profile: Profile, staffId: string | null) {
  const existing = await prisma.customerInteraction.count({ where: { clientId } });
  if (existing > 0) return;

  if (profile === "A") {
    // 3 recent approved interactions
    for (const [type, dA, notes] of [
      ["CALL",  3,  "Q2 business review — 45 min, very positive"],
      ["VISIT", 7,  "On-site check-in, reviewed open tickets"],
      ["EMAIL", 14, "Shared Q3 roadmap document"],
    ] as [string, number, string][]) {
      await prisma.customerInteraction.create({ data: {
        clientId, staffId, type: type as "CALL"|"VISIT"|"EMAIL",
        date: daysAgo(dA), notes, outcome: "Positive",
        approved: true, rejected: false, direction: "OUTBOUND",
      }});
    }
  } else if (profile === "B") {
    // 1 interaction 10 days ago
    await prisma.customerInteraction.create({ data: {
      clientId, staffId, type: "CALL",
      date: daysAgo(10), notes: "Monthly check-in call",
      outcome: "Stable", approved: true, rejected: false, direction: "OUTBOUND",
    }});
  } else if (profile === "C") {
    // 1 old interaction (45 days ago)
    await prisma.customerInteraction.create({ data: {
      clientId, staffId, type: "EMAIL",
      date: daysAgo(45), notes: "Sent renewal reminder",
      outcome: "No response", approved: true, rejected: false, direction: "OUTBOUND",
    }});
  }
  // D: no interactions
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("\n🚀 seed-health: starting...\n");

  const clients = await prisma.client.findMany({
    select: { id: true, firstName: true, lastName: true, company: true },
    orderBy: { createdAt: "asc" },
  });

  const staff = await prisma.staff.findFirst({
    where: { email: "admin@askworx.com" },
    select: { id: true },
  });

  console.log(`📋 Found ${clients.length} clients\n`);

  // Profile rotation: A, A, B, B, B, C, C, C, D (gives ~Healthy 22%, Stable 33%, At Risk 33%, Critical 11%)
  const PROFILES: Profile[] = ["A","A","B","B","B","C","C","C","D"];

  let invoicesCreated     = 0;
  let projectsCreated     = 0;
  let interactionsCreated = 0;
  let scoresComputed      = 0;

  for (let i = 0; i < clients.length; i++) {
    const client  = clients[i];
    const profile = PROFILES[i % PROFILES.length];

    // Track counts before
    const [invBefore, projBefore, intBefore] = await Promise.all([
      prisma.invoice.count({ where: { clientId: client.id } }),
      prisma.project.count({ where: { clientId: client.id } }),
      prisma.customerInteraction.count({ where: { clientId: client.id } }),
    ]);

    await seedInvoices(client.id, profile);
    await seedProject(client.id, profile);
    await seedInteractions(client.id, profile, staff?.id ?? null);

    const [invAfter, projAfter, intAfter] = await Promise.all([
      prisma.invoice.count({ where: { clientId: client.id } }),
      prisma.project.count({ where: { clientId: client.id } }),
      prisma.customerInteraction.count({ where: { clientId: client.id } }),
    ]);

    invoicesCreated     += invAfter - invBefore;
    projectsCreated     += projAfter - projBefore;
    interactionsCreated += intAfter - intBefore;

    // Delete stale score so we always recompute fresh
    await prisma.customerHealthScore.deleteMany({ where: { clientId: client.id } });

    const score = await computeAndPersistScore(client.id);
    scoresComputed++;

    const icon  = score >= 80 ? "🟢" : score >= 60 ? "🟡" : score >= 40 ? "🟠" : "🔴";
    const label = score >= 80 ? "Healthy" : score >= 60 ? "Stable" : score >= 40 ? "At Risk" : "Critical";
    console.log(`   ${icon} [${profile}] ${client.firstName} ${client.lastName} (${client.company ?? "—"}) → ${score} ${label}`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const [healthy, stable, atRisk, critical] = await Promise.all([
    prisma.customerHealthScore.count({ where: { score: { gte: 80 } } }),
    prisma.customerHealthScore.count({ where: { score: { gte: 60, lt: 80 } } }),
    prisma.customerHealthScore.count({ where: { score: { gte: 40, lt: 60 } } }),
    prisma.customerHealthScore.count({ where: { score: { lt: 40 } } }),
  ]);

  console.log("\n─────────────────────────────────────────");
  console.log(`✅ Invoices created     : ${invoicesCreated}`);
  console.log(`✅ Projects created     : ${projectsCreated}`);
  console.log(`✅ Interactions created : ${interactionsCreated}`);
  console.log(`✅ Scores computed      : ${scoresComputed}`);
  console.log(`\n📊 Health distribution:`);
  console.log(`   🟢 Healthy  (80+) : ${healthy}`);
  console.log(`   🟡 Stable   (60+) : ${stable}`);
  console.log(`   🟠 At Risk  (40+) : ${atRisk}`);
  console.log(`   🔴 Critical (<40) : ${critical}`);
  console.log("\n🎉 seed-health done!\n");
}

main()
  .catch((e) => {
    console.error("❌ seed-health failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
