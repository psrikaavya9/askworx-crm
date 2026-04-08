"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { LeadCard } from "./LeadCard";
import { cn, formatCurrency } from "@/lib/utils";
import type { KanbanColumn } from "@/modules/crm/types";

interface DynamicPipelineColumnProps {
  column: KanbanColumn;
}

export function DynamicPipelineColumn({ column }: DynamicPipelineColumnProps) {
  const { stage, leads, totalValue, count } = column;
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <div className="flex w-64 shrink-0 flex-col">
      {/* Column header */}
      <div
        className="mb-2 rounded-lg px-3 py-2.5"
        style={{ backgroundColor: `${stage.color}18` }} // 18 = ~10% opacity
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: stage.color }}
              />
              <p className="text-xs font-bold uppercase tracking-wide text-slate-700">
                {stage.name}
              </p>
              {(stage.isWon || stage.isLost) && (
                <span
                  className={cn(
                    "rounded px-1 py-0.5 text-[9px] font-bold uppercase",
                    stage.isWon ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                  )}
                >
                  {stage.isWon ? "WON" : "LOST"}
                </span>
              )}
            </div>
            {totalValue > 0 && (
              <p className="mt-0.5 text-[11px] font-medium text-slate-400">
                {formatCurrency(totalValue)}
                {stage.probability > 0 && (
                  <span className="ml-1 text-slate-300">· {stage.probability}%</span>
                )}
              </p>
            )}
          </div>
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white px-1.5 text-[10px] font-bold text-slate-600 ring-1 ring-slate-200">
            {count}
          </span>
        </div>
      </div>

      {/* Cards droppable area */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 space-y-2 rounded-xl border-2 border-t-4 p-2 transition-all",
          isOver
            ? "border-indigo-300 bg-indigo-50/70"
            : "border-slate-200 bg-slate-50/50"
        )}
        style={{ borderTopColor: stage.color }}
      >
        <SortableContext
          items={leads.map((l) => l.id)}
          strategy={verticalListSortingStrategy}
        >
          {leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead as any} />
          ))}
        </SortableContext>
        {leads.length === 0 && (
          <div className="flex min-h-[120px] items-center justify-center rounded-lg border-2 border-dashed border-slate-200 text-xs text-slate-300 select-none">
            Drop here
          </div>
        )}
      </div>
    </div>
  );
}
