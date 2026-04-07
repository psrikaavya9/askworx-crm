/**
 * seed-pipeline.ts
 *
 * Idempotent pipeline seed:
 *   1. Ensures 3 pipeline templates exist (PRODUCT, SERVICE, AMC) with stages
 *   2. Assigns dealType to all leads  (40% PRODUCT · 30% SERVICE · 30% AMC)
 *   3. Deletes any existing LeadPipeline records for leads being (re-)assigned
 *   4. Creates fresh LeadPipeline records that map each lead to the correct
 *      template and the matching stage within that template
 *
 * Stage mapping (Lead.stage → template stage name):
 *
 *   PRODUCT  : NEW→Inquiry · CONTACTED→Demo · QUALIFIED→Proposal Sent
 *              PROPOSAL→Negotiation · WON→Won · LOST→Lost
 *
 *   SERVICE  : NEW→Inquiry · CONTACTED→Consultation · QUALIFIED→Scoping
 *              PROPOSAL→Proposal · WON→Completed · LOST→Lost
 *
 *   AMC      : NEW→Prospect · CONTACTED→Site Survey · QUALIFIED→Quotation
 *              PROPOSAL→Agreement · WON→Active · LOST→Expired
 *
 * Run: npx tsx --tsconfig tsconfig.seed.json prisma/seed-pipeline.ts
 */

import "dotenv/config";
import { Pool }         from "pg";
import { PrismaPg }    from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const pool    = new Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma  = new (PrismaClient as any)({ adapter }) as PrismaClient;

// ---------------------------------------------------------------------------
// Template definitions (mirrors /api/crm/pipeline/seed)
// ---------------------------------------------------------------------------

const TEMPLATES = [
  {
    name: "Product Sales",
    dealType: "PRODUCT",
    description: "Standard pipeline for one-time product deals",
    stages: [
      { name: "Inquiry",       order: 0, probability: 10,  color: "#6366f1", isWon: false, isLost: false },
      { name: "Demo",          order: 1, probability: 25,  color: "#8b5cf6", isWon: false, isLost: false },
      { name: "Proposal Sent", order: 2, probability: 50,  color: "#f59e0b", isWon: false, isLost: false },
      { name: "Negotiation",   order: 3, probability: 75,  color: "#f97316", isWon: false, isLost: false },
      { name: "Won",           order: 4, probability: 100, color: "#10b981", isWon: true,  isLost: false },
      { name: "Lost",          order: 5, probability: 0,   color: "#ef4444", isWon: false, isLost: true  },
    ],
    stageMap: { NEW: "Inquiry", CONTACTED: "Demo", QUALIFIED: "Proposal Sent", PROPOSAL: "Negotiation", WON: "Won", LOST: "Lost" },
  },
  {
    name: "Service Delivery",
    dealType: "SERVICE",
    description: "Pipeline for recurring or project-based service engagements",
    stages: [
      { name: "Inquiry",      order: 0, probability: 10,  color: "#6366f1", isWon: false, isLost: false },
      { name: "Consultation", order: 1, probability: 30,  color: "#8b5cf6", isWon: false, isLost: false },
      { name: "Scoping",      order: 2, probability: 50,  color: "#0ea5e9", isWon: false, isLost: false },
      { name: "Proposal",     order: 3, probability: 65,  color: "#f59e0b", isWon: false, isLost: false },
      { name: "Contracted",   order: 4, probability: 90,  color: "#f97316", isWon: false, isLost: false },
      { name: "Completed",    order: 5, probability: 100, color: "#10b981", isWon: true,  isLost: false },
      { name: "Lost",         order: 6, probability: 0,   color: "#ef4444", isWon: false, isLost: true  },
    ],
    stageMap: { NEW: "Inquiry", CONTACTED: "Consultation", QUALIFIED: "Scoping", PROPOSAL: "Proposal", WON: "Completed", LOST: "Lost" },
  },
  {
    name: "AMC / Maintenance",
    dealType: "AMC",
    description: "Annual maintenance contract pipeline with renewal tracking",
    stages: [
      { name: "Prospect",    order: 0, probability: 10,  color: "#6366f1", isWon: false, isLost: false },
      { name: "Site Survey", order: 1, probability: 30,  color: "#8b5cf6", isWon: false, isLost: false },
      { name: "Quotation",   order: 2, probability: 50,  color: "#f59e0b", isWon: false, isLost: false },
      { name: "Agreement",   order: 3, probability: 80,  color: "#f97316", isWon: false, isLost: false },
      { name: "Active",      order: 4, probability: 100, color: "#10b981", isWon: true,  isLost: false },
      { name: "Renewal Due", order: 5, probability: 70,  color: "#0ea5e9", isWon: false, isLost: false },
      { name: "Expired",     order: 6, probability: 0,   color: "#ef4444", isWon: false, isLost: true  },
    ],
    stageMap: { NEW: "Prospect", CONTACTED: "Site Survey", QUALIFIED: "Quotation", PROPOSAL: "Agreement", WON: "Active", LOST: "Expired" },
  },
] as const;

// Deal type distribution: 40% PRODUCT · 30% SERVICE · 30% AMC
const DEAL_TYPE_DIST = ["PRODUCT","PRODUCT","PRODUCT","PRODUCT","SERVICE","SERVICE","SERVICE","AMC","AMC","AMC"] as const;

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("\n🚀 seed-pipeline: starting...\n");

  // ── 1. Ensure all templates + stages exist ────────────────────────────────
  console.log("📋 Ensuring pipeline templates...");
  const templateMap = new Map<string, { id: string; stages: Map<string, string> }>();

  for (const tmpl of TEMPLATES) {
    let template = await prisma.pipelineTemplate.findFirst({
      where:   { dealType: tmpl.dealType },
      include: { stages: { orderBy: { order: "asc" } } },
    });

    if (!template) {
      template = await prisma.pipelineTemplate.create({
        data: {
          name:        tmpl.name,
          dealType:    tmpl.dealType,
          description: tmpl.description,
          isActive:    true,
          stages:      { create: tmpl.stages.map((s) => ({ ...s })) },
        },
        include: { stages: { orderBy: { order: "asc" } } },
      });
      console.log(`   ✅ Created template: ${tmpl.name} (${tmpl.dealType})`);
    } else {
      console.log(`   ⏭  Template exists: ${tmpl.name} (${tmpl.dealType})`);
    }

    // Build stage-name → stage-id map (lowercase for safe lookup)
    const stageIdMap = new Map<string, string>(
      template.stages.map((s: { name: string; id: string }) => [s.name.toLowerCase(), s.id])
    );
    templateMap.set(tmpl.dealType, { id: template.id, stages: stageIdMap });
  }

  // ── 2. Load all leads ─────────────────────────────────────────────────────
  console.log("\n👥 Assigning deal types to leads...");
  const leads = await prisma.lead.findMany({
    select: { id: true, stage: true, dealType: true },
    orderBy: { createdAt: "asc" },
  });

  // Assign dealType deterministically — keeps the distribution stable across
  // re-runs; leads that already have a dealType keep it.
  let typeAssigned = 0;
  for (let i = 0; i < leads.length; i++) {
    if (!leads[i].dealType) {
      const dt = DEAL_TYPE_DIST[i % DEAL_TYPE_DIST.length];
      await prisma.lead.update({ where: { id: leads[i].id }, data: { dealType: dt } });
      leads[i] = { ...leads[i], dealType: dt };
      typeAssigned++;
    }
  }
  console.log(`   ✅ Assigned dealType to ${typeAssigned} leads`);

  // Distribution summary
  const dist: Record<string, number> = {};
  for (const l of leads) { dist[l.dealType ?? "null"] = (dist[l.dealType ?? "null"] ?? 0) + 1; }
  console.log(`   📊 PRODUCT: ${dist["PRODUCT"] ?? 0} · SERVICE: ${dist["SERVICE"] ?? 0} · AMC: ${dist["AMC"] ?? 0}`);

  // ── 3. (Re-)assign each lead to the correct template ─────────────────────
  console.log("\n🔗 Linking leads to pipeline templates...");

  // Group leads by dealType
  const byType: Record<string, typeof leads> = { PRODUCT: [], SERVICE: [], AMC: [] };
  for (const l of leads) {
    const dt = l.dealType ?? "PRODUCT";
    if (!byType[dt]) byType[dt] = [];
    byType[dt].push(l);
  }

  const STAGE_MAP: Record<string, Record<string, string>> = {
    PRODUCT: { NEW: "Inquiry", CONTACTED: "Demo",          QUALIFIED: "Proposal Sent", PROPOSAL: "Negotiation", WON: "Won",       LOST: "Lost"    },
    SERVICE: { NEW: "Inquiry", CONTACTED: "Consultation",  QUALIFIED: "Scoping",       PROPOSAL: "Proposal",    WON: "Completed",  LOST: "Lost"    },
    AMC:     { NEW: "Prospect",CONTACTED: "Site Survey",   QUALIFIED: "Quotation",     PROPOSAL: "Agreement",   WON: "Active",     LOST: "Expired" },
  };

  let linked = 0, skipped = 0;

  for (const [dealType, typeLeads] of Object.entries(byType)) {
    const tmplInfo = templateMap.get(dealType);
    if (!tmplInfo) continue;

    for (const lead of typeLeads) {
      // Check if already in the CORRECT template
      const existing = await prisma.leadPipeline.findUnique({
        where:  { leadId: lead.id },
        select: { templateId: true },
      });

      if (existing?.templateId === tmplInfo.id) {
        skipped++;
        continue; // already correct — leave stage position as-is
      }

      // Delete existing pipeline record if in wrong template
      if (existing) {
        await prisma.leadPipeline.delete({ where: { leadId: lead.id } });
      }

      // Resolve target stage in the new template
      const stageNameRaw = STAGE_MAP[dealType]?.[lead.stage] ?? "Inquiry";
      const stageId = tmplInfo.stages.get(stageNameRaw.toLowerCase())
                   ?? tmplInfo.stages.values().next().value; // fallback to first stage

      if (!stageId) continue;

      await prisma.leadPipeline.create({
        data: {
          leadId:         lead.id,
          templateId:     tmplInfo.id,
          currentStageId: stageId,
          stageUpdatedAt: new Date(),
          history: {
            create: {
              toStageId: stageId,
              changedBy: "seed",
              reason:    `Assigned by pipeline seed — dealType: ${dealType}, legacy stage: ${lead.stage}`,
            },
          },
        },
      });
      linked++;
    }
  }

  console.log(`   ✅ ${linked} leads linked · ${skipped} already correct`);

  // ── Summary ───────────────────────────────────────────────────────────────
  const [totalLeads, totalPipelines] = await Promise.all([
    prisma.lead.count(),
    prisma.leadPipeline.count(),
  ]);

  for (const tmpl of TEMPLATES) {
    const info = templateMap.get(tmpl.dealType);
    if (!info) continue;
    const count = await prisma.leadPipeline.count({ where: { templateId: info.id } });
    console.log(`   ${tmpl.dealType.padEnd(8)} template (${tmpl.name}): ${count} leads`);
  }

  console.log("\n─────────────────────────────────────────");
  console.log(`✅ Total leads     : ${totalLeads}`);
  console.log(`✅ Total pipelines : ${totalPipelines}`);
  console.log("\n🎉 seed-pipeline done!\n");
}

main()
  .catch((e) => {
    console.error("❌ seed-pipeline failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
