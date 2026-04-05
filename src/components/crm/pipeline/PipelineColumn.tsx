import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { LeadCard } from "./LeadCard";
import type { Lead, PipelineStage } from "@/modules/crm/types";
import { PIPELINE_STAGE_LABELS } from "@/modules/crm/types";
import { cn, formatCurrency } from "@/lib/utils";

const columnTopColors: Record<PipelineStage, string> = {
  NEW:       "border-t-slate-400",
  CONTACTED: "border-t-blue-400",
  QUALIFIED: "border-t-amber-400",
  PROPOSAL:  "border-t-violet-500",
  WON:       "border-t-emerald-500",
  LOST:      "border-t-red-400",
};

const columnHeaderBg: Record<PipelineStage, string> = {
  NEW:       "bg-slate-50",
  CONTACTED: "bg-blue-50/60",
  QUALIFIED: "bg-amber-50/60",
  PROPOSAL:  "bg-violet-50/60",
  WON:       "bg-emerald-50/60",
  LOST:      "bg-red-50/60",
};

interface PipelineColumnProps {
  stage: PipelineStage;
  leads: Lead[];
}

export function PipelineColumn({ stage, leads }: PipelineColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const totalValue = leads.reduce((s, l) => s + Number(l.dealValue ?? 0), 0);

  return (
    <div className="flex w-64 shrink-0 flex-col">
      {/* Column header */}
      <div className={cn("mb-2 flex items-center justify-between rounded-lg px-3 py-2.5", columnHeaderBg[stage])}>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-700">{PIPELINE_STAGE_LABELS[stage]}</p>
          {totalValue > 0 && (
            <p className="text-[11px] font-medium text-slate-400">{formatCurrency(totalValue)}</p>
          )}
        </div>
        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white px-1.5 text-[10px] font-bold text-slate-600 ring-1 ring-slate-200">
          {leads.length}
        </span>
      </div>

      {/* Cards */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 space-y-2 rounded-xl border-2 p-2 transition-all",
          "border-t-4",
          columnTopColors[stage],
          isOver
            ? "border-indigo-300 bg-indigo-50/70"
            : "border-slate-200 bg-slate-50/50"
        )}
      >
        <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          {leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} />
          ))}
        </SortableContext>
        {leads.length === 0 && (
          <div className="flex h-16 items-center justify-center text-xs text-slate-300 select-none">
            Drop here
          </div>
        )}
      </div>
    </div>
  );
}
