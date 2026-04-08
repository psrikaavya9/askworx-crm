"use client";

/**
 * Thin client boundary that lazy-loads DynamicPipelineBoard with ssr:false.
 *
 * Why this file exists:
 *   next/dynamic({ ssr: false }) is only legal inside a "use client" module.
 *   page.tsx is a Server Component, so the dynamic() call must live here
 *   instead — this wrapper is the client boundary that owns it.
 */
import dynamic from "next/dynamic";
import type { KanbanView } from "@/modules/crm/types";

const Board = dynamic(
  () => import("./DynamicPipelineBoard").then((m) => m.DynamicPipelineBoard),
  { ssr: false },
);

interface Props {
  initialData: KanbanView;
}

export function PipelineBoardClient({ initialData }: Props) {
  return <Board key={initialData.template.id} initialData={initialData} />;
}
