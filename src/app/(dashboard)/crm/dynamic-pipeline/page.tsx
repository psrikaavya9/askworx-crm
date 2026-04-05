import Link from "next/link";
import { listTemplates } from "@/modules/crm/services/pipeline-template.service";
import { serializePrisma } from "@/lib/serialize";
import type { PipelineTemplate } from "@/modules/crm/types";
import { Layers, Plus, ChevronRight } from "lucide-react";

const DEAL_TYPE_LABELS: Record<string, string> = {
  PRODUCT: "Product Sales",
  SERVICE: "Service Project",
  AMC:     "AMC / Retainer",
};

const DEAL_TYPE_COLORS: Record<string, string> = {
  PRODUCT: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  SERVICE: "bg-violet-50 text-violet-700 ring-violet-200",
  AMC:     "bg-amber-50  text-amber-700  ring-amber-200",
};

export default async function DynamicPipelineIndexPage() {
  const templates = serializePrisma(await listTemplates()) as PipelineTemplate[];

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Dynamic Pipelines</h1>
          <p className="mt-1 text-sm text-gray-500">
            Each deal type has its own custom pipeline stages.
          </p>
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-20 text-center">
          <Layers className="mb-3 h-10 w-10 text-slate-300" />
          <p className="font-medium text-slate-500">No pipeline templates yet</p>
          <p className="mt-1 text-sm text-slate-400">
            Use the API to create templates for Product, Service, and AMC deals.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <Link
              key={t.id}
              href={`/crm/dynamic-pipeline/${t.id}`}
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-indigo-300 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${DEAL_TYPE_COLORS[t.dealType] ?? "bg-gray-50 text-gray-600 ring-gray-200"}`}
                  >
                    {DEAL_TYPE_LABELS[t.dealType] ?? t.dealType}
                  </span>
                  <h2 className="mt-2 text-base font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                    {t.name}
                  </h2>
                  {t.description && (
                    <p className="mt-1 text-xs text-gray-400 line-clamp-2">{t.description}</p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-indigo-500 transition-colors" />
              </div>

              {/* Stage pills */}
              {t.stages.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {t.stages.map((s) => (
                    <span
                      key={s.id}
                      className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                      style={{ backgroundColor: s.color }}
                    >
                      {s.name}
                    </span>
                  ))}
                </div>
              )}

              <p className="mt-3 text-[11px] text-slate-400">
                {t.stages.length} stage{t.stages.length !== 1 ? "s" : ""} ·{" "}
                {t.isActive ? (
                  <span className="text-emerald-500">Active</span>
                ) : (
                  <span className="text-red-400">Inactive</span>
                )}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
