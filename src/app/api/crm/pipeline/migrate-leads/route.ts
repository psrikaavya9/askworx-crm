/**
 * POST /api/crm/pipeline/migrate-leads
 *
 * Assigns all leads that have no LeadPipeline (or are in the wrong template)
 * to the template matching their `dealType` field:
 *   dealType = "PRODUCT" → Product Sales template
 *   dealType = "SERVICE" → Service Delivery template
 *   dealType = "AMC"     → AMC / Maintenance template
 *   dealType = null      → defaults to PRODUCT
 *
 * Stage mapping (Lead.stage → template stage name):
 *   PRODUCT : NEW→Inquiry · CONTACTED→Demo · QUALIFIED→Proposal Sent · PROPOSAL→Negotiation · WON→Won · LOST→Lost
 *   SERVICE : NEW→Inquiry · CONTACTED→Consultation · QUALIFIED→Scoping · PROPOSAL→Proposal · WON→Completed · LOST→Lost
 *   AMC     : NEW→Prospect · CONTACTED→Site Survey · QUALIFIED→Quotation · PROPOSAL→Agreement · WON→Active · LOST→Expired
 *
 * Query params:
 *   ?remap=true   — also move leads that are already in the wrong template
 *
 * Response: { migrated, remapped, distribution }
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Stage name maps per deal type
const STAGE_MAPS: Record<string, Record<string, string>> = {
  PRODUCT: { NEW: "Inquiry", CONTACTED: "Demo",         QUALIFIED: "Proposal Sent", PROPOSAL: "Negotiation", WON: "Won",      LOST: "Lost"    },
  SERVICE: { NEW: "Inquiry", CONTACTED: "Consultation", QUALIFIED: "Scoping",       PROPOSAL: "Proposal",    WON: "Completed", LOST: "Lost"    },
  AMC:     { NEW: "Prospect",CONTACTED: "Site Survey",  QUALIFIED: "Quotation",     PROPOSAL: "Agreement",   WON: "Active",    LOST: "Expired" },
};

const BATCH_SIZE = 50;

export async function POST(req: NextRequest) {
  const remap = req.nextUrl.searchParams.get("remap") === "true";

  // ── Load all active templates indexed by dealType ─────────────────────────
  const templates = await prisma.pipelineTemplate.findMany({
    where:   { isActive: true },
    include: { stages: { orderBy: { order: "asc" } } },
  });

  if (templates.length === 0) {
    return NextResponse.json(
      { error: "No active pipeline templates found. Run /api/crm/pipeline/seed first." },
      { status: 400 }
    );
  }

  // Build: dealType → { templateId, stageByName }
  const tmplByType = new Map<string, { id: string; stageByName: Map<string, string>; fallbackId: string }>();
  for (const t of templates) {
    const stageByName = new Map(t.stages.map((s) => [s.name.toLowerCase(), s.id]));
    tmplByType.set(t.dealType, { id: t.id, stageByName, fallbackId: t.stages[0]?.id ?? "" });
  }

  // If no PRODUCT template, refuse — it's the default fallback
  if (!tmplByType.has("PRODUCT")) {
    return NextResponse.json({ error: "PRODUCT template not found." }, { status: 400 });
  }

  function resolveStageId(dealType: string, leadStage: string): string {
    const tmpl = tmplByType.get(dealType) ?? tmplByType.get("PRODUCT")!;
    const targetName = (STAGE_MAPS[dealType] ?? STAGE_MAPS["PRODUCT"])[leadStage] ?? "";
    return tmpl.stageByName.get(targetName.toLowerCase()) ?? tmpl.fallbackId;
  }

  function resolveTemplateId(dealType: string | null): string {
    const dt = dealType ?? "PRODUCT";
    return (tmplByType.get(dt) ?? tmplByType.get("PRODUCT")!).id;
  }

  const distribution: Record<string, number> = {};
  let migrated = 0;
  let remapped  = 0;

  // ── 1. Assign leads with no pipeline ─────────────────────────────────────
  const unassigned = await prisma.lead.findMany({
    where:  { leadPipeline: { is: null } },
    select: { id: true, stage: true, dealType: true },
  });

  for (let i = 0; i < unassigned.length; i += BATCH_SIZE) {
    const batch = unassigned.slice(i, i + BATCH_SIZE);
    await prisma.$transaction(async (tx) => {
      for (const lead of batch) {
        const dt      = lead.dealType ?? "PRODUCT";
        const tmplId  = resolveTemplateId(lead.dealType);
        const stageId = resolveStageId(dt, lead.stage);

        await tx.leadPipeline.create({
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
        migrated++;
      }
    });
  }

  // ── 2. Remap leads in the wrong template ─────────────────────────────────
  if (remap) {
    const allPipelines = await prisma.leadPipeline.findMany({
      include: { lead: { select: { id: true, stage: true, dealType: true } } },
    });

    const wrongTemplate = allPipelines.filter((lp) => {
      const correctTmplId = resolveTemplateId(lp.lead.dealType);
      return lp.templateId !== correctTmplId;
    });

    for (let i = 0; i < wrongTemplate.length; i += BATCH_SIZE) {
      const batch = wrongTemplate.slice(i, i + BATCH_SIZE);
      await prisma.$transaction(async (tx) => {
        for (const lp of batch) {
          const dt      = lp.lead.dealType ?? "PRODUCT";
          const tmplId  = resolveTemplateId(lp.lead.dealType);
          const stageId = resolveStageId(dt, lp.lead.stage);

          await tx.leadPipeline.update({
            where: { id: lp.id },
            data: {
              templateId:     tmplId,
              currentStageId: stageId,
              stageUpdatedAt: new Date(),
              history: {
                create: {
                  fromStageId: lp.currentStageId,
                  toStageId:   stageId,
                  changedBy:   "system",
                  reason:      `Remapped — dealType:${dt}`,
                },
              },
            },
          });
          distribution[dt] = (distribution[dt] ?? 0) + 1;
          remapped++;
        }
      });
    }
  }

  return NextResponse.json({ migrated, remapped, distribution });
}
