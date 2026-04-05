"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { PipelineStage } from "@/modules/crm/types";
import { PIPELINE_STAGE_LABELS } from "@/modules/crm/types";

const ACTIVE_STAGES: PipelineStage[] = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON"];

const stageIndex: Record<PipelineStage, number> = {
  NEW: 0, CONTACTED: 1, QUALIFIED: 2, PROPOSAL: 3, WON: 4, LOST: -1,
};

interface StageProgressBarProps {
  leadId: string;
  currentStage: PipelineStage;
}

export function StageProgressBar({ leadId, currentStage }: StageProgressBarProps) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);
  const currentIdx = stageIndex[currentStage];

  async function moveToStage(stage: PipelineStage) {
    if (updating || stage === currentStage) return;
    setUpdating(true);
    try {
      await fetch(`/api/crm/leads/${leadId}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-user-id": "admin" },
        body: JSON.stringify({ stage }),
      });
      router.refresh();
    } finally {
      setUpdating(false);
    }
  }

  if (currentStage === "LOST") {
    return (
      <div className="rounded-lg bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
        Lead marked as Lost
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {ACTIVE_STAGES.map((stage, idx) => {
        const isCurrent = stage === currentStage;
        const isDone = currentIdx > idx;
        return (
          <button
            key={stage}
            onClick={() => moveToStage(stage)}
            disabled={updating}
            className={cn(
              "flex flex-1 items-center justify-center rounded-md py-1.5 text-xs font-medium transition-all",
              "first:rounded-l-lg last:rounded-r-lg",
              isCurrent && "bg-indigo-600 text-white shadow",
              isDone && !isCurrent && "bg-indigo-100 text-indigo-700 hover:bg-indigo-200",
              !isCurrent && !isDone && "bg-gray-100 text-gray-400 hover:bg-gray-200"
            )}
          >
            {PIPELINE_STAGE_LABELS[stage]}
          </button>
        );
      })}
    </div>
  );
}
