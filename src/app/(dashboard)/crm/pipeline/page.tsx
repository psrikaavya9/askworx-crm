import { prisma } from "@/lib/prisma";
import { PipelinePageClient } from "@/components/crm/pipeline/PipelinePageClient";
import { serializePrisma } from "@/lib/serialize";
import type { KanbanView, PipelineTemplate } from "@/modules/crm/types";

interface Props {
  searchParams: Promise<{ template?: string }>;
}

export default async function PipelinePage({ searchParams }: Props) {
  const { template: templateId } = await searchParams;

  // ── Load all active templates ───────────────────────────────────────────
  const rawTemplates = await prisma.pipelineTemplate.findMany({
    where:   { isActive: true },
    include: { stages: { orderBy: { order: "asc" } } },
    orderBy: { createdAt: "asc" },
  });
  const templates = serializePrisma(rawTemplates) as PipelineTemplate[];

  // ── Resolve which template to show ─────────────────────────────────────
  // Use URL param → first template in list → null (no templates)
  const selectedId =
    (templateId && templates.find((t) => t.id === templateId)?.id) ||
    templates[0]?.id ||
    null;

  const selectedTemplate = templates.find((t) => t.id === selectedId) ?? null;

  // ── Load kanban data for the selected template ─────────────────────────
  let kanban: KanbanView | null = null;

  if (selectedId) {
    const rawTemplate = await prisma.pipelineTemplate.findUniqueOrThrow({
      where:   { id: selectedId },
      include: { stages: { orderBy: { order: "asc" } } },
    });

    const leadPipelines = await prisma.leadPipeline.findMany({
      where: { templateId: selectedId },
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
    });

    // Group leads by stage in one pass
    const byStage = new Map<string, typeof leadPipelines>(
      rawTemplate.stages.map((s) => [s.id, []])
    );
    for (const lp of leadPipelines) {
      byStage.get(lp.currentStageId)?.push(lp);
    }

    const columns = rawTemplate.stages.map((stage) => {
      const entries = byStage.get(stage.id) ?? [];
      const leads   = entries.map((lp) => ({
        ...lp.lead,
        stageUpdatedAt: lp.stageUpdatedAt as unknown as string | null,
      }));
      const totalValue = leads.reduce((s, l) => s + Number(l.dealValue ?? 0), 0);
      const weightedValue = leads.reduce(
        (s, l) => s + Number(l.dealValue ?? 0) * (stage.probability / 100),
        0
      );
      return { stage, leads, totalValue, weightedValue, count: leads.length };
    });

    const totalPipelineValue = columns.reduce((s, c) => s + c.totalValue, 0);
    const forecastedValue    = columns.reduce((s, c) => s + c.weightedValue, 0);

    kanban = serializePrisma({
      template: rawTemplate,
      columns,
      totalPipelineValue,
      forecastedValue,
    }) as KanbanView;
  }

  return (
    <div className="flex flex-col h-full p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900">Pipeline</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Dynamic deal pipelines — drag cards to move stages
        </p>
      </div>

      <div className="flex-1 overflow-x-auto">
        <PipelinePageClient
          templates={templates}
          selectedTemplate={selectedTemplate}
          kanban={kanban}
          templateId={selectedId}
        />
      </div>
    </div>
  );
}
