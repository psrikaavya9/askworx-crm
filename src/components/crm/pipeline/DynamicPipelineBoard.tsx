"use client";

import { useState, useCallback, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";

/**
 * Custom collision strategy for multi-column kanban.
 *
 * Problem: dnd-kit's `closestCenter` only compares centre-point distances.
 * When a column is EMPTY its only registered droppable is the container div.
 * Nearby populated columns always win the closest-centre race, making empty
 * columns impossible to drop into.
 *
 * Fix (recommended in dnd-kit docs):
 *   1. Try `pointerWithin` first — if the pointer is inside any droppable
 *      area (including the empty column's container), return that hit.
 *   2. Fall back to `rectIntersection` — catches cases where the dragged
 *      card overlaps the column rect even if the pointer is outside it.
 */
const multiColumnCollision: CollisionDetection = (args) => {
  const ptrHits = pointerWithin(args);
  if (ptrHits.length > 0) return ptrHits;
  return rectIntersection(args);
};
import { DynamicPipelineColumn } from "./DynamicPipelineColumn";
import { LeadCardOverlay } from "./LeadCard";
import { WinLossReasonModal, type CloseOutcome } from "./WinLossReasonModal";
import type { KanbanView, KanbanColumn } from "@/modules/crm/types";
import type { Lead } from "@/modules/crm/types";
import { formatCurrency } from "@/lib/utils";

interface DynamicPipelineBoardProps {
  initialData: KanbanView;
}

interface PendingMove {
  leadId:       string;
  leadName:     string;
  sourceColumn: KanbanColumn;
  targetColumn: KanbanColumn;
  outcome:      CloseOutcome;
}

export function DynamicPipelineBoard({ initialData }: DynamicPipelineBoardProps) {
  const [columns,      setColumns]      = useState<KanbanColumn[]>(initialData.columns);
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null);
  const [pendingMove,  setPendingMove]  = useState<PendingMove | null>(null);

  // Sync columns when the parent provides new data (template switch)
  useEffect(() => {
    setColumns(initialData.columns);
  }, [initialData]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const findLeadById = useCallback(
    (id: string) =>
      columns.flatMap((c) => c.leads).find((l) => l.id === id) as Lead | undefined,
    [columns]
  );

  const findLeadColumn = useCallback(
    (leadId: string) => columns.find((c) => c.leads.some((l) => l.id === leadId)),
    [columns]
  );

  function onDragStart({ active }: DragStartEvent) {
    setActiveLeadId(String(active.id));
  }

  async function onDragEnd({ active, over }: DragEndEvent) {
    setActiveLeadId(null);
    if (!over) return;

    const leadId      = String(active.id);
    const targetId    = String(over.id);

    const targetColumn =
      columns.find((c) => c.stage.id === targetId) ?? findLeadColumn(targetId);

    if (!targetColumn) return;

    const sourceColumn = findLeadColumn(leadId);
    if (!sourceColumn || sourceColumn.stage.id === targetColumn.stage.id) return;

    const lead = findLeadById(leadId);
    if (!lead) return;

    // WON or LOST → pause and show reason modal before calling API
    if (targetColumn.stage.isWon || targetColumn.stage.isLost) {
      setPendingMove({
        leadId,
        leadName:     `${(lead as any).firstName} ${(lead as any).lastName}`,
        sourceColumn,
        targetColumn,
        outcome:      targetColumn.stage.isWon ? "WON" : "LOST",
      });
      return; // don't call API yet — wait for modal confirmation
    }

    await commitMove(lead, sourceColumn, targetColumn, undefined);
  }

  /** Executes the optimistic update + API call */
  async function commitMove(
    lead:         Lead,
    sourceColumn: KanbanColumn,
    targetColumn: KanbanColumn,
    reason:       string | undefined,
  ) {
    // Optimistic update
    setColumns((prev) =>
      prev.map((col) => {
        if (col.stage.id === sourceColumn.stage.id) {
          const newLeads = col.leads.filter((l) => l.id !== lead.id);
          return { ...col, leads: newLeads, count: newLeads.length,
            totalValue: newLeads.reduce((s, l) => s + Number(l.dealValue ?? 0), 0) } as KanbanColumn;
        }
        if (col.stage.id === targetColumn.stage.id) {
          const newLeads = [lead, ...col.leads];
          return { ...col, leads: newLeads, count: newLeads.length,
            totalValue: newLeads.reduce((s, l) => s + Number(l.dealValue ?? 0), 0) } as KanbanColumn;
        }
        return col;
      })
    );

    const isBackward = targetColumn.stage.order < sourceColumn.stage.order;

    try {
      const res = await fetch(`/api/crm/leads/${lead.id}/pipeline/stage`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json", "x-user-id": "admin" },
        body:    JSON.stringify({
          stageId: targetColumn.stage.id,
          reason:  reason ?? (isBackward ? "Moved back via Kanban" : undefined),
        }),
      });
      if (!res.ok) setColumns(initialData.columns); // revert on server error
    } catch {
      setColumns(initialData.columns);
    }
  }

  /** Called when user submits the WinLoss modal */
  async function handleReasonConfirm(reason: string) {
    if (!pendingMove) return;
    const { leadId, sourceColumn, targetColumn } = pendingMove;
    const lead = findLeadById(leadId);
    setPendingMove(null);
    if (lead) await commitMove(lead, sourceColumn, targetColumn, reason);
  }

  function handleReasonCancel() {
    setPendingMove(null); // card stays in source column — no optimistic update was done
  }

  const activeLead      = activeLeadId ? findLeadById(activeLeadId) : null;
  const totalValue      = columns.reduce((s, c) => s + c.totalValue, 0);
  const forecastedValue = columns.reduce(
    (s, c) => s + c.totalValue * (c.stage.probability / 100), 0
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Summary bar */}
      <div className="flex items-center gap-6 rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Pipeline Value</p>
          <p className="text-lg font-bold text-slate-900">{formatCurrency(totalValue)}</p>
        </div>
        <div className="h-8 w-px bg-slate-200" />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Forecasted Revenue</p>
          <p className="text-lg font-bold text-emerald-600">{formatCurrency(forecastedValue)}</p>
        </div>
        <div className="h-8 w-px bg-slate-200" />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Total Leads</p>
          <p className="text-lg font-bold text-slate-900">
            {columns.reduce((s, c) => s + c.count, 0)}
          </p>
        </div>
      </div>

      {/* Kanban */}
      <DndContext
        sensors={sensors}
        collisionDetection={multiColumnCollision}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((col) => (
            <DynamicPipelineColumn key={col.stage.id} column={col} />
          ))}
        </div>
        <DragOverlay>
          {activeLead ? <LeadCardOverlay lead={activeLead as any} /> : null}
        </DragOverlay>
      </DndContext>

      {/* Win / Loss reason modal */}
      {pendingMove && (
        <WinLossReasonModal
          open
          outcome={pendingMove.outcome}
          leadName={pendingMove.leadName}
          stageName={pendingMove.targetColumn.stage.name}
          onConfirm={handleReasonConfirm}
          onCancel={handleReasonCancel}
        />
      )}
    </div>
  );
}
