/**
 * scripts/migrate-pipeline.ts
 *
 * Assigns leads to pipeline templates based on dealType.
 * Distributes null-dealType leads 40% PRODUCT / 30% SERVICE / 30% AMC.
 *
 * Run: npx tsx scripts/migrate-pipeline.ts
 */

import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const pool    = new Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma  = new (PrismaClient as any)({ adapter }) as PrismaClient;

const STAGE_MAPS: Record<string, Record<string, string>> = {
  PRODUCT: { NEW: "Inquiry", CONTACTED: "Demo",         QUALIFIED: "Proposal Sent", PROPOSAL: "Negotiation", WON: "Won",      LOST: "Lost"    },
  SERVICE: { NEW: "Inquiry", CONTACTED: "Consultation", QUALIFIED: "Scoping",       PROPOSAL: "Proposal",    WON: "Completed", LOST: "Lost"    },
  AMC:     { NEW: "Prospect",CONTACTED: "Site Survey",  QUALIFIED: "Quotation",     PROPOSAL: "Agreement",   WON: "Active",    LOST: "Expired" },
};

async function main() {
  console.log("🔧 Migrating leads to pipeline templates...\n");

  // Load templates
  const templates = await prisma.pipelineTemplate.findMany({
    where:   { isActive: true },
    include: { stages: { orderBy: { order: "asc" } } },
  });

  if (templates.length === 0) {
    throw new Error("No active pipeline templates found. Run /api/crm/pipeline/seed first.");
  }

  console.log(`Templates loaded: ${templates.map((t: any) => t.dealType).join(", ")}`);

  type TmplInfo = { id: string; stageByName: Map<string, string>; fallbackId: string };
  const tmplByType = new Map<string, TmplInfo>();
  for (const t of templates) {
    const stageByName = new Map<string, string>(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (t.stages as any[]).map((s) => [s.name.toLowerCase(), s.id] as [string, string])
    );
    tmplByType.set(t.dealType, { id: t.id, stageByName, fallbackId: (t.stages as any[])[0]?.id ?? "" });
  }

  function resolveStageId(dealType: string, leadStage: string): string {
    const tmpl = tmplByType.get(dealType) ?? tmplByType.get("PRODUCT")!;
    const targetName = (STAGE_MAPS[dealType] ?? STAGE_MAPS["PRODUCT"])[leadStage] ?? "";
    return tmpl.stageByName.get(targetName.toLowerCase()) ?? tmpl.fallbackId;
  }

  // Load unassigned leads
  const unassigned = await prisma.lead.findMany({
    where:  { leadPipeline: { is: null } },
    select: { id: true, stage: true, dealType: true },
  });

  console.log(`Unassigned leads: ${unassigned.length}`);
  if (unassigned.length === 0) {
    console.log("✅ Nothing to do.");
    return;
  }

  // Distribute null-dealType leads 40/30/30
  const DIST = ["PRODUCT", "PRODUCT", "PRODUCT", "PRODUCT", "SERVICE", "SERVICE", "SERVICE", "AMC", "AMC", "AMC"] as const;
  let distIdx = 0;

  const distribution: Record<string, number> = {};
  let done = 0;
  let failed = 0;

  for (const lead of unassigned) {
    try {
      let dt = lead.dealType ?? null;
      if (!dt) {
        dt = DIST[distIdx % DIST.length];
        distIdx++;
      }

      const tmplId  = (tmplByType.get(dt) ?? tmplByType.get("PRODUCT")!).id;
      const stageId = resolveStageId(dt, lead.stage);

      await prisma.leadPipeline.create({
        data: {
          leadId:         lead.id,
          templateId:     tmplId,
          currentStageId: stageId,
          history: {
            create: {
              toStageId: stageId,
              changedBy: "system",
              reason:    `Migrated — dealType:${dt} legacyStage:${lead.stage}`,
            },
          },
        },
      });

      distribution[dt] = (distribution[dt] ?? 0) + 1;
      done++;

      // Also update the lead's dealType if it was null
      if (!lead.dealType) {
        await prisma.lead.update({ where: { id: lead.id }, data: { dealType: dt } });
      }

      if (done % 50 === 0) process.stdout.write(`  ${done}/${unassigned.length}\n`);
    } catch (err) {
      console.error(`  ❌ lead ${lead.id}:`, (err as Error).message);
      failed++;
    }
  }

  console.log(`\n✅ Migration complete: ${done} migrated, ${failed} failed`);
  console.log("Distribution:", distribution);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect().then(() => pool.end()));
