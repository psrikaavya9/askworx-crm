import { prisma } from "@/lib/prisma";
import type {
  CreateTemplateInput,
  UpdateTemplateInput,
  CreateStageInput,
  UpdateStageConfigInput,
  ReorderStagesInput,
  AssignPipelineInput,
  MoveStageInput,
} from "../schemas/pipeline-template.schema";

// ---------------------------------------------------------------------------
// Template CRUD
// ---------------------------------------------------------------------------

export async function findTemplates(activeOnly = false) {
  return prisma.pipelineTemplate.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    include: { stages: { orderBy: { order: "asc" } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function findTemplateById(id: string) {
  return prisma.pipelineTemplate.findUnique({
    where: { id },
    include: { stages: { orderBy: { order: "asc" } } },
  });
}

export async function findTemplateByDealType(dealType: string) {
  return prisma.pipelineTemplate.findFirst({
    where: { dealType, isActive: true },
    include: { stages: { orderBy: { order: "asc" } } },
  });
}

export async function createTemplate(data: CreateTemplateInput) {
  return prisma.pipelineTemplate.create({ data, include: { stages: true } });
}

export async function updateTemplate(id: string, data: UpdateTemplateInput) {
  return prisma.pipelineTemplate.update({
    where: { id },
    data,
    include: { stages: { orderBy: { order: "asc" } } },
  });
}

export async function deleteTemplate(id: string) {
  // Soft-delete: deactivate rather than hard delete to preserve history
  return prisma.pipelineTemplate.update({
    where: { id },
    data: { isActive: false },
  });
}

// ---------------------------------------------------------------------------
// Stage config CRUD
// ---------------------------------------------------------------------------

export async function addStage(templateId: string, data: CreateStageInput) {
  return prisma.pipelineStageConfig.create({
    data: { ...data, templateId },
  });
}

export async function updateStageConfig(stageId: string, data: UpdateStageConfigInput) {
  return prisma.pipelineStageConfig.update({ where: { id: stageId }, data });
}

export async function deleteStageConfig(stageId: string) {
  return prisma.pipelineStageConfig.delete({ where: { id: stageId } });
}

export async function reorderStages(templateId: string, input: ReorderStagesInput) {
  // Batch update orders in a transaction
  return prisma.$transaction(
    input.stages.map(({ id, order }) =>
      prisma.pipelineStageConfig.update({ where: { id, templateId }, data: { order } })
    )
  );
}

// ---------------------------------------------------------------------------
// Lead pipeline assignment
// ---------------------------------------------------------------------------

export async function findLeadPipeline(leadId: string) {
  return prisma.leadPipeline.findUnique({
    where: { leadId },
    include: {
      template: { include: { stages: { orderBy: { order: "asc" } } } },
      currentStage: true,
      history: {
        include: { fromStage: true, toStage: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });
}

export async function assignPipeline(leadId: string, input: AssignPipelineInput) {
  const template = await prisma.pipelineTemplate.findUniqueOrThrow({
    where: { id: input.templateId },
    include: { stages: { orderBy: { order: "asc" } } },
  });

  const firstStage = template.stages[0];
  if (!firstStage) throw new Error("Template has no stages");

  const stageId = input.stageId ?? firstStage.id;

  // Verify stageId belongs to this template
  const stageExists = template.stages.some((s) => s.id === stageId);
  if (!stageExists) throw new Error("Stage does not belong to this template");

  return prisma.leadPipeline.upsert({
    where: { leadId },
    create: {
      leadId,
      templateId: input.templateId,
      currentStageId: stageId,
      history: {
        create: {
          toStageId: stageId,
          changedBy: "system",
          reason: "Pipeline assigned",
        },
      },
    },
    update: {
      templateId: input.templateId,
      currentStageId: stageId,
      stageUpdatedAt: new Date(),
      history: {
        create: {
          toStageId: stageId,
          changedBy: "system",
          reason: "Pipeline re-assigned",
        },
      },
    },
    include: {
      template: { include: { stages: { orderBy: { order: "asc" } } } },
      currentStage: true,
    },
  });
}

export async function moveLeadStage(leadId: string, input: MoveStageInput) {
  const lp = await prisma.leadPipeline.findUniqueOrThrow({
    where: { leadId },
    include: {
      currentStage: true,
      template: { include: { stages: { orderBy: { order: "asc" } } } },
    },
  });

  const targetStage = lp.template.stages.find((s) => s.id === input.stageId);
  if (!targetStage) throw new Error("Stage does not belong to this lead's template");

  const fromOrder  = lp.currentStage.order;
  const toOrder    = targetStage.order;
  const isBackward = toOrder < fromOrder;

  if (isBackward && !input.reason) {
    throw new Error("A reason is required when moving a lead backward in the pipeline");
  }
  if (targetStage.isWon && !input.reason) {
    throw new Error("A win reason is required when closing a lead as Won");
  }
  if (targetStage.isLost && !input.reason) {
    throw new Error("A loss reason is required when closing a lead as Lost");
  }

  const now = new Date();

  // Build the Lead update for WON / LOST finalisation
  const leadUpdate: Record<string, unknown> = {};
  if (targetStage.isWon)  { leadUpdate.convertedAt = now; leadUpdate.winReason  = input.reason; }
  if (targetStage.isLost) { leadUpdate.lostAt      = now; leadUpdate.lostReason = input.reason; }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.leadPipeline.update({
      where: { leadId },
      data: {
        currentStageId: input.stageId,
        stageUpdatedAt: now,
        history: {
          create: {
            fromStageId: lp.currentStageId,
            toStageId:   input.stageId,
            changedBy:   input.changedBy,
            reason:      input.reason,
          },
        },
      },
      include: {
        currentStage: true,
        template: { include: { stages: { orderBy: { order: "asc" } } } },
      },
    });

    // Persist win/loss reason + timestamp back on the Lead itself
    if (Object.keys(leadUpdate).length > 0) {
      await tx.lead.update({ where: { id: leadId }, data: leadUpdate });
    }

    return updated;
  });
}

// ---------------------------------------------------------------------------
// Kanban view — single DB round-trip, group in application layer
// ---------------------------------------------------------------------------

export async function getKanbanView(templateId: string) {
  const [template, leadPipelines] = await Promise.all([
    prisma.pipelineTemplate.findUniqueOrThrow({
      where: { id: templateId },
      include: { stages: { orderBy: { order: "asc" } } },
    }),
    prisma.leadPipeline.findMany({
      where: { templateId },
      include: {
        lead: {
          include: {
            score: true,
            _count: { select: { activities: true, notes: true } },
          },
        },
        currentStage: true,
      },
      orderBy: { stageUpdatedAt: "desc" },
    }),
  ]);

  // Group leads by stage in one pass — O(leads)
  const byStage = new Map<string, typeof leadPipelines>(
    template.stages.map((s) => [s.id, []])
  );
  for (const lp of leadPipelines) {
    byStage.get(lp.currentStageId)?.push(lp);
  }

  const columns = template.stages.map((stage) => {
    const entries = byStage.get(stage.id) ?? [];
    const leads   = entries.map((lp) => lp.lead);
    const totalValue = leads.reduce((s, l) => s + Number(l.dealValue ?? 0), 0);
    const weightedValue = leads.reduce(
      (s, l) => s + Number(l.dealValue ?? 0) * (stage.probability / 100),
      0
    );
    return { stage, leads, totalValue, weightedValue, count: leads.length };
  });

  const totalPipelineValue = columns.reduce((s, c) => s + c.totalValue, 0);
  const forecastedValue    = columns.reduce((s, c) => s + c.weightedValue, 0);

  return { template, columns, totalPipelineValue, forecastedValue };
}
