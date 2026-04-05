import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/dev/seed/crm
 * Seeds realistic CRM lead data across all pipeline stages.
 * Idempotent — skips creation if leads already exist.
 */
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const existing = await prisma.lead.count();
  if (existing > 0) {
    return NextResponse.json({ message: "CRM data already seeded", count: existing });
  }

  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

  // ── Won leads: create client records first, then link ──────────────────────

  const clientAlpha = await prisma.client.create({
    data: {
      firstName: "Sarah",
      lastName: "Mitchell",
      email: "sarah.mitchell@alpharetail.com",
      phone: "+1 415 555 0101",
      company: "Alpha Retail Group",
      jobTitle: "VP of Operations",
      assignedTo: "admin",
      tags: ["enterprise", "retail"],
    },
  });

  const clientBeta = await prisma.client.create({
    data: {
      firstName: "Daniel",
      lastName: "Torres",
      email: "daniel.torres@betafinance.io",
      phone: "+1 212 555 0182",
      company: "Beta Finance IO",
      jobTitle: "CFO",
      assignedTo: "admin",
      tags: ["fintech", "smb"],
    },
  });

  // ── Seed leads ─────────────────────────────────────────────────────────────

  const leads = [
    // ── NEW (2) ──────────────────────────────────────────────────────────────
    {
      firstName: "Emily",
      lastName: "Chen",
      email: "emily.chen@novatech.io",
      phone: "+1 650 555 0210",
      company: "NovaTech Solutions",
      jobTitle: "Head of Procurement",
      source: "WEBSITE" as const,
      stage: "NEW" as const,
      priority: "HIGH" as const,
      dealValue: 28000,
      currency: "USD",
      assignedTo: "admin",
      tags: ["saas", "tech"],
      createdAt: daysAgo(2),
    },
    {
      firstName: "James",
      lastName: "Okafor",
      email: "james.okafor@swiftlogistics.com",
      phone: "+1 312 555 0347",
      company: "Swift Logistics",
      jobTitle: "Operations Manager",
      source: "REFERRAL" as const,
      stage: "NEW" as const,
      priority: "MEDIUM" as const,
      dealValue: 12500,
      currency: "USD",
      assignedTo: "admin",
      tags: ["logistics"],
      createdAt: daysAgo(1),
    },

    // ── CONTACTED (2) ────────────────────────────────────────────────────────
    {
      firstName: "Priya",
      lastName: "Sharma",
      email: "priya.sharma@zenithhealth.com",
      phone: "+1 408 555 0093",
      company: "Zenith Health",
      jobTitle: "IT Director",
      source: "EMAIL_CAMPAIGN" as const,
      stage: "CONTACTED" as const,
      priority: "HIGH" as const,
      dealValue: 45000,
      currency: "USD",
      assignedTo: "admin",
      tags: ["healthcare", "enterprise"],
      contactedAt: daysAgo(5),
      createdAt: daysAgo(10),
    },
    {
      firstName: "Marcus",
      lastName: "Webb",
      email: "marcus.webb@greenfield.co",
      phone: "+1 617 555 0461",
      company: "Greenfield Co.",
      jobTitle: "CEO",
      source: "COLD_CALL" as const,
      stage: "CONTACTED" as const,
      priority: "LOW" as const,
      dealValue: 8000,
      currency: "USD",
      assignedTo: "admin",
      tags: ["smb"],
      contactedAt: daysAgo(3),
      createdAt: daysAgo(8),
    },

    // ── QUALIFIED (2) ────────────────────────────────────────────────────────
    {
      firstName: "Amara",
      lastName: "Diallo",
      email: "amara.diallo@meridiangroup.com",
      phone: "+1 202 555 0712",
      company: "Meridian Group",
      jobTitle: "Procurement Director",
      source: "TRADE_SHOW" as const,
      stage: "QUALIFIED" as const,
      priority: "HIGH" as const,
      dealValue: 65000,
      currency: "USD",
      assignedTo: "admin",
      tags: ["enterprise", "government"],
      contactedAt: daysAgo(18),
      qualifiedAt: daysAgo(10),
      createdAt: daysAgo(25),
    },
    {
      firstName: "Lucas",
      lastName: "Ferreira",
      email: "lucas.ferreira@pixelwave.design",
      phone: "+1 310 555 0834",
      company: "PixelWave Design",
      jobTitle: "Creative Director",
      source: "SOCIAL_MEDIA" as const,
      stage: "QUALIFIED" as const,
      priority: "MEDIUM" as const,
      dealValue: 18500,
      currency: "USD",
      assignedTo: "admin",
      tags: ["agency", "creative"],
      contactedAt: daysAgo(12),
      qualifiedAt: daysAgo(6),
      createdAt: daysAgo(20),
    },

    // ── PROPOSAL (2) ─────────────────────────────────────────────────────────
    {
      firstName: "Nina",
      lastName: "Kowalski",
      email: "nina.kowalski@cloudrise.eu",
      phone: "+48 22 555 0921",
      company: "CloudRise EU",
      jobTitle: "CTO",
      source: "PARTNER" as const,
      stage: "PROPOSAL" as const,
      priority: "HIGH" as const,
      dealValue: 120000,
      currency: "USD",
      assignedTo: "admin",
      tags: ["enterprise", "cloud", "europe"],
      contactedAt: daysAgo(30),
      qualifiedAt: daysAgo(20),
      proposalAt: daysAgo(7),
      createdAt: daysAgo(40),
    },
    {
      firstName: "Raj",
      lastName: "Patel",
      email: "raj.patel@orbitmfg.com",
      phone: "+1 734 555 0558",
      company: "Orbit Manufacturing",
      jobTitle: "Supply Chain Manager",
      source: "REFERRAL" as const,
      stage: "PROPOSAL" as const,
      priority: "MEDIUM" as const,
      dealValue: 37000,
      currency: "USD",
      assignedTo: "admin",
      tags: ["manufacturing"],
      contactedAt: daysAgo(22),
      qualifiedAt: daysAgo(14),
      proposalAt: daysAgo(4),
      createdAt: daysAgo(30),
    },

    // ── WON (2) — linked to pre-created clients ──────────────────────────────
    {
      firstName: "Sarah",
      lastName: "Mitchell",
      email: "sarah.mitchell@alpharetail.com",
      phone: "+1 415 555 0101",
      company: "Alpha Retail Group",
      jobTitle: "VP of Operations",
      source: "WEBSITE" as const,
      stage: "WON" as const,
      priority: "HIGH" as const,
      dealValue: 92000,
      currency: "USD",
      assignedTo: "admin",
      tags: ["enterprise", "retail"],
      contactedAt: daysAgo(60),
      qualifiedAt: daysAgo(50),
      proposalAt: daysAgo(40),
      convertedAt: daysAgo(15),
      createdAt: daysAgo(75),
      clientId: clientAlpha.id,
    },
    {
      firstName: "Daniel",
      lastName: "Torres",
      email: "daniel.torres@betafinance.io",
      phone: "+1 212 555 0182",
      company: "Beta Finance IO",
      jobTitle: "CFO",
      source: "EMAIL_CAMPAIGN" as const,
      stage: "WON" as const,
      priority: "HIGH" as const,
      dealValue: 54000,
      currency: "USD",
      assignedTo: "admin",
      tags: ["fintech", "smb"],
      contactedAt: daysAgo(55),
      qualifiedAt: daysAgo(45),
      proposalAt: daysAgo(35),
      convertedAt: daysAgo(10),
      createdAt: daysAgo(70),
      clientId: clientBeta.id,
    },

    // ── LOST (2) ─────────────────────────────────────────────────────────────
    {
      firstName: "Kevin",
      lastName: "Huang",
      email: "kevin.huang@vortexcorp.com",
      phone: "+1 503 555 0274",
      company: "Vortex Corp",
      jobTitle: "Purchasing Manager",
      source: "COLD_CALL" as const,
      stage: "LOST" as const,
      priority: "LOW" as const,
      dealValue: 9500,
      currency: "USD",
      assignedTo: "admin",
      tags: [],
      contactedAt: daysAgo(45),
      qualifiedAt: daysAgo(35),
      lostAt: daysAgo(20),
      lostReason: "Went with a competitor offering a lower price.",
      createdAt: daysAgo(55),
    },
    {
      firstName: "Fatima",
      lastName: "Al-Rashid",
      email: "fatima.alrashid@nexusmed.ae",
      phone: "+971 4 555 0386",
      company: "Nexus Medical",
      jobTitle: "Head of IT",
      source: "TRADE_SHOW" as const,
      stage: "LOST" as const,
      priority: "MEDIUM" as const,
      dealValue: 31000,
      currency: "USD",
      assignedTo: "admin",
      tags: ["healthcare", "international"],
      contactedAt: daysAgo(50),
      qualifiedAt: daysAgo(38),
      proposalAt: daysAgo(25),
      lostAt: daysAgo(12),
      lostReason: "Budget freeze — revisit next quarter.",
      createdAt: daysAgo(65),
    },
  ];

  const created: string[] = [];

  for (const leadData of leads) {
    const lead = await prisma.lead.create({
      data: {
        ...leadData,
        activities: {
          create: {
            type: "LEAD_CREATED",
            description: "Lead created via seed",
            performedBy: "admin",
            createdAt: leadData.createdAt,
          },
        },
      },
    });
    created.push(lead.id);
  }

  // Seed a few reminders for active leads
  const activeleads = await prisma.lead.findMany({
    where: { stage: { in: ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL"] } },
    take: 4,
  });

  const futureDate = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);

  for (let i = 0; i < activeleads.length; i++) {
    await prisma.followUpReminder.create({
      data: {
        leadId: activeleads[i].id,
        title: ["Follow-up call", "Send updated proposal", "Demo scheduling", "Check in"][i] ?? "Follow-up",
        description: "Scheduled as part of seed data",
        dueAt: futureDate(i + 1),
        status: "PENDING",
        assignedTo: "admin",
        createdBy: "admin",
      },
    });
  }

  // Seed one overdue reminder
  if (activeleads.length > 0) {
    await prisma.followUpReminder.create({
      data: {
        leadId: activeleads[0].id,
        title: "Overdue: Send pricing sheet",
        dueAt: daysAgo(3),
        status: "OVERDUE",
        assignedTo: "admin",
        createdBy: "admin",
      },
    });
  }

  return NextResponse.json({
    message: "CRM seed data created successfully",
    leads: created.length,
    clients: 2,
    reminders: Math.min(activeleads.length, 4) + 1,
  });
}
