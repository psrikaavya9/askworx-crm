"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { PipelineColumn } from "./PipelineColumn";
import { LeadCardOverlay } from "./LeadCard";
import type { Lead, PipelineStage } from "@/modules/crm/types";
import { PIPELINE_STAGES } from "@/modules/crm/types";

const KANBAN_STAGES = PIPELINE_STAGES.filter((s) => s !== "LOST");

interface PipelineBoardProps {
  initialLeads: Lead[];
}

export function PipelineBoard({ initialLeads }: PipelineBoardProps) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const getLeadsByStage = useCallback(
    (stage: PipelineStage) => leads.filter((l) => l.stage === stage),
    [leads]
  );

  const activeLead = activeId ? leads.find((l) => l.id === activeId) : null;

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id));
  }

  async function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;

    const leadId = String(active.id);
    const newStage = String(over.id) as PipelineStage;

    // `over.id` is either a stage id (column droppable) or a lead id (sortable).
    // We only handle column drops (stage changes).
    if (!PIPELINE_STAGES.includes(newStage)) return;

    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.stage === newStage) return;

    // Optimistic update
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, stage: newStage } : l))
    );

    try {
      const res = await fetch(`/api/crm/leads/${leadId}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-user-id": "admin" },
        body: JSON.stringify({ stage: newStage }),
      });
      if (!res.ok) {
        // Revert on failure
        setLeads((prev) =>
          prev.map((l) => (l.id === leadId ? { ...l, stage: lead.stage } : l))
        );
      }
    } catch {
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, stage: lead.stage } : l))
      );
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {KANBAN_STAGES.map((stage) => (
          <PipelineColumn key={stage} stage={stage} leads={getLeadsByStage(stage)} />
        ))}
      </div>
      <DragOverlay>
        {activeLead ? <LeadCardOverlay lead={activeLead} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
