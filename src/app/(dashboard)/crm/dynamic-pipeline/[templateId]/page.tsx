import { notFound } from "next/navigation";
import Link from "next/link";
import { getKanban, listTemplates } from "@/modules/crm/services/pipeline-template.service";
import { PipelineBoardClient } from "@/components/crm/pipeline/PipelineBoardClient";
import { serializePrisma } from "@/lib/serialize";
import type { KanbanView, PipelineTemplate } from "@/modules/crm/types";
import { ChevronLeft } from "lucide-react";

const DEAL_TYPE_LABELS: Record<string, string> = {
  PRODUCT: "Product Sales",
  SERVICE: "Service Project",
  AMC:     "AMC / Retainer",
};

interface PageProps {
  params: Promise<{ templateId: string }>;
}

export default async function DynamicPipelinePage({ params }: PageProps) {
  const { templateId } = await params;

  let kanban: KanbanView;
  let allTemplates: PipelineTemplate[];

  try {
    [kanban, allTemplates] = await Promise.all([
      getKanban(templateId).then((d) => serializePrisma(d) as KanbanView),
      listTemplates(true).then((d) => serializePrisma(d) as PipelineTemplate[]),
    ]);
  } catch {
    notFound();
  }

  return (
    <div className="flex h-full flex-col p-6">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/crm/dynamic-pipeline"
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Pipelines
          </Link>
          <span className="text-slate-300">/</span>
          <h1 className="text-xl font-semibold text-gray-900">{kanban.template.name}</h1>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
            {DEAL_TYPE_LABELS[kanban.template.dealType] ?? kanban.template.dealType}
          </span>
        </div>

        {/* Pipeline Switcher */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Switch pipeline:</span>
          <div className="flex gap-1">
            {allTemplates.map((t) => (
              <Link
                key={t.id}
                href={`/crm/dynamic-pipeline/${t.id}`}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  t.id === templateId
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {t.name}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Board — rendered client-only to avoid dnd-kit aria attribute mismatch */}
      <div className="flex-1 overflow-x-auto">
        <PipelineBoardClient initialData={kanban} />
      </div>
    </div>
  );
}
