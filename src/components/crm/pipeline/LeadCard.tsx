"use client";

import Link from "next/link";
import { formatCurrency, getInitials } from "@/lib/utils";
import { PriorityBadge } from "@/components/crm/shared/PriorityBadge";
import { ScoreBadge } from "@/components/crm/shared/ScoreBadge";
import type { Lead, LeadScore } from "@/modules/crm/types";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { Building2, Snowflake } from "lucide-react";

interface LeadCardProps {
  lead: Lead & { _count?: { notes: number; activities: number }; score?: LeadScore | null };
  overlay?: boolean;
}

export function LeadCard({ lead, overlay }: LeadCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "rounded-xl border border-slate-200 bg-white p-3 shadow-sm",
        "cursor-grab active:cursor-grabbing select-none",
        "hover:border-indigo-200 hover:shadow-md transition-all",
        isDragging && "opacity-40",
        overlay && "rotate-2 shadow-xl border-indigo-300"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-indigo-200 text-[10px] font-bold text-indigo-700">
            {getInitials(lead.firstName, lead.lastName)}
          </div>
          <div className="min-w-0">
            <Link
              href={`/crm/leads/${lead.id}`}
              onClick={(e) => e.stopPropagation()}
              className="truncate text-sm font-semibold text-slate-900 hover:text-indigo-600 transition-colors"
            >
              {lead.firstName} {lead.lastName}
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {lead.isCold && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">
              <Snowflake className="h-2.5 w-2.5" />
              Cold
            </span>
          )}
          <PriorityBadge priority={lead.priority} />
        </div>
      </div>

      {lead.score && (
        <div className="mt-1.5">
          <ScoreBadge category={lead.score.category} score={lead.score.totalScore} />
        </div>
      )}

      {lead.company && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
          <Building2 className="h-3 w-3 shrink-0" />
          <span className="truncate">{lead.company}</span>
        </div>
      )}

      {lead.dealValue && (
        <p className="mt-2 text-sm font-bold text-slate-800">
          {formatCurrency(Number(lead.dealValue))}
        </p>
      )}
    </div>
  );
}

export function LeadCardOverlay({ lead }: { lead: Lead }) {
  return <LeadCard lead={lead} overlay />;
}
