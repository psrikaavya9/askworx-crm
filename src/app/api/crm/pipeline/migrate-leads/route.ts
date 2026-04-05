/**
 * POST /api/crm/pipeline/migrate-leads
 *
 * Assigns all leads that currently have no LeadPipeline to the active
 * PRODUCT template, mapping their existing fixed stage to the closest
 * dynamic stage by name. Safe to call multiple times — idempotent.
 *
 * Stage mapping (fixed → dynamic Product template):
 *   NEW       → Inquiry
 *   CONTACTED → Demo
 *   QUALIFIED → Proposal Sent
 *   PROPOSAL  → Negotiation
 *   WON       → Won  (isWon stage)
 *   LOST      → Lost (isLost stage)
 *
 * Response: { migrated: number, mapping: Record<string, string> }
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Maps the legacy fixed PipelineStage enum value to a stage name in the
// Product template. Matched case-insensitively against stage.name.
const STAGE_NAME_MAP: Record<string, string> = {
  NEW:       "Inquiry",
  CONTACTED: "Demo",
  QUALIFIED: "Proposal Sent",
  PROPOSAL:  "Negotiation",
  WON:       "Won",
  LOST:      "Lost",
};

const BATCH_SIZE = 50;

export async function POST(req: import("next/server").NextRequest) {
  // ?remap=true  → also update leads that are already assigned but sitting at the
  //                 wrong stage (e.g., everything landed in Inquiry from a prior run)
  const remap = req.nextUrl.searchParams.get("remap") === "true";

  // Find the default template (PRODUCT, active)
  const template = await prisma.pipelineTemplate.findFirst({
    where:   { dealType: "PRODUCT", isActive: true },
    include: { stages: { orderBy: { order: "asc" } } },
  });

  if (!template) {
    return NextResponse.json(
      { error: "No active PRODUCT pipeline template found. Run /api/crm/pipeline/seed first." },
      { status: 400 },
    );
  }

  if (template.stages.length === 0) {
    return NextResponse.json({ error: "PRODUCT template has no stages." }, { status: 400 });
  }

  // Build a lookup: stage name (lowercase) → stage id
  const stageByName = new Map(
    template.stages.map((s) => [s.name.toLowerCase(), s])
  );
  const fallbackStage = template.stages[0];

  // Resolve which dynamic stage a legacy stage maps to
  function resolveStage(legacyStage: string) {
    const targetName = STAGE_NAME_MAP[legacyStage]?.toLowerCase();
    return (targetName ? stageByName.get(targetName) : undefined) ?? fallbackStage;
  }

  const mapping: Record<string, number> = {};
  let migrated = 0;
  let remapped = 0;

  // ── 1. Assign leads that have NO pipeline yet ─────────────────────────────
  const unassigned = await prisma.lead.findMany({
    where:  { leadPipeline: { is: null } },
    select: { id: true, stage: true },
  });

  for (let i = 0; i < unassigned.length; i += BATCH_SIZE) {
    const batch = unassigned.slice(i, i + BATCH_SIZE);
    await prisma.$transaction(async (tx) => {
      for (const lead of batch) {
        const targetStage = resolveStage(lead.stage);
        await tx.leadPipeline.create({
          data: {
            leadId:         lead.id,
            templateId:     template.id,
            currentStageId: targetStage.id,
            history: {
              create: {
                toStageId: targetStage.id,
                changedBy: "system",
                reason:    `Migrated from legacy stage: ${lead.stage}`,
              },
            },
          },
        });
        mapping[targetStage.name] = (mapping[targetStage.name] ?? 0) + 1;
        migrated++;
      }
    });
  }

  // ── 2. Remap already-assigned leads to their correct stage ────────────────
  if (remap) {
    const assigned = await prisma.leadPipeline.findMany({
      where:   { templateId: template.id },
      include: { lead: { select: { id: true, stage: true } } },
    });

    for (let i = 0; i < assigned.length; i += BATCH_SIZE) {
      const batch = assigned.slice(i, i + BATCH_SIZE);
      await prisma.$transaction(async (tx) => {
        for (const lp of batch) {
          const targetStage = resolveStage(lp.lead.stage);
          if (lp.currentStageId === targetStage.id) continue; // already correct
          await tx.leadPipeline.update({
            where: { id: lp.id },
            data: {
              currentStageId: targetStage.id,
              stageUpdatedAt: new Date(),
              history: {
                create: {
                  fromStageId: lp.currentStageId,
                  toStageId:   targetStage.id,
                  changedBy:   "system",
                  reason:      `Stage remapped from legacy: ${lp.lead.stage}`,
                },
              },
            },
          });
          mapping[targetStage.name] = (mapping[targetStage.name] ?? 0) + 1;
          remapped++;
        }
      });
    }
  }

  return NextResponse.json({
    migrated,
    remapped,
    template: template.name,
    mapping,
  });
}
