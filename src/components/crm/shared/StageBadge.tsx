import { Badge } from "@/components/ui/Badge";
import type { PipelineStage } from "@/modules/crm/types";

const stageConfig: Record<PipelineStage, { label: string; variant: "gray" | "blue" | "yellow" | "purple" | "green" | "red" }> = {
  NEW: { label: "New", variant: "gray" },
  CONTACTED: { label: "Contacted", variant: "blue" },
  QUALIFIED: { label: "Qualified", variant: "yellow" },
  PROPOSAL: { label: "Proposal", variant: "purple" },
  WON: { label: "Won", variant: "green" },
  LOST: { label: "Lost", variant: "red" },
};

export function StageBadge({ stage }: { stage: PipelineStage }) {
  const config = stageConfig[stage];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
