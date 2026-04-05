/**
 * POST /api/crm/pipeline/reassign
 *
 * Moves a set of leads to a different pipeline template, placing each
 * lead at the first stage of the target template.
 *
 * Body:
 *   {
 *     leadIds:  string[]   — IDs of leads to move
 *     dealType: "PRODUCT" | "SERVICE" | "AMC"
 *   }
 *
 * How it works:
 *   Each lead has exactly one LeadPipeline row (leadId is @unique).
 *   We UPDATE that row: change templateId + currentStageId + write history.
 *   No new rows are created; no schema changes needed.
 *
 * Response:
 *   { moved: number, template: string, startStage: string, skipped: string[] }
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const bodySchema = z.object({
  leadIds:  z.array(z.string().min(1)).min(1),
  dealType: z.enum(["PRODUCT", "SERVICE", "AMC"]),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { leadIds, dealType } = parsed.data;

  // Resolve target template + first stage
  const template = await prisma.pipelineTemplate.findFirst({
    where:   { dealType, isActive: true },
    include: { stages: { orderBy: { order: "asc" } } },
  });

  if (!template) {
    return NextResponse.json(
      { error: `No active ${dealType} pipeline template found. Run /api/crm/pipeline/seed first.` },
      { status: 400 },
    );
  }

  const firstStage = template.stages[0];
  if (!firstStage) {
    return NextResponse.json(
      { error: `${dealType} template has no stages.` },
      { status: 400 },
    );
  }

  // Fetch existing LeadPipeline records for these leads
  const existing = await prisma.leadPipeline.findMany({
    where:  { leadId: { in: leadIds } },
    select: { id: true, leadId: true, currentStageId: true },
  });

  const existingByLeadId = new Map(existing.map((lp) => [lp.leadId, lp]));
  const skipped: string[] = leadIds.filter((id) => !existingByLeadId.has(id));

  const toMove = existing.filter(
    (lp) => lp.currentStageId !== firstStage.id || /* already on this template? check via lookup */ false
  );

  if (toMove.length === 0 && skipped.length === leadIds.length) {
    return NextResponse.json({
      moved: 0,
      skipped,
      message: "None of the provided leads have a pipeline assigned. Run /api/crm/pipeline/migrate-leads first.",
    });
  }

  // Update in a single transaction
  await prisma.$transaction(
    toMove.map((lp) =>
      prisma.leadPipeline.update({
        where: { id: lp.id },
        data: {
          templateId:     template.id,
          currentStageId: firstStage.id,
          stageUpdatedAt: new Date(),
          history: {
            create: {
              fromStageId: lp.currentStageId,
              toStageId:   firstStage.id,
              changedBy:   "system",
              reason:      `Reassigned to ${dealType} pipeline`,
            },
          },
        },
      })
    )
  );

  return NextResponse.json({
    moved:      toMove.length,
    skipped,
    template:   template.name,
    startStage: firstStage.name,
  });
}
