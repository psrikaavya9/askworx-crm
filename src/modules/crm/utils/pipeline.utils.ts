import type { PipelineStage } from "../types";
import { PIPELINE_STAGES } from "../types";

/**
 * Returns the next valid stage after the given one.
 * WON and LOST have no next stage.
 */
export function getNextStage(current: PipelineStage): PipelineStage | null {
  const activeStages = PIPELINE_STAGES.filter((s): s is Exclude<PipelineStage, "LOST"> => s !== "LOST");
  const idx = activeStages.indexOf(current as Exclude<PipelineStage, "LOST">);
  if (idx === -1 || idx === activeStages.length - 1) return null;
  return activeStages[idx + 1];
}

/**
 * Returns true if moving from `from` to `to` is a forward progression.
 */
export function isForwardProgression(from: PipelineStage, to: PipelineStage): boolean {
  const order: Record<PipelineStage, number> = {
    NEW: 0,
    CONTACTED: 1,
    QUALIFIED: 2,
    PROPOSAL: 3,
    WON: 4,
    LOST: 4,
  };
  return order[to] > order[from];
}

/**
 * Returns a CSS color class for each pipeline stage (Tailwind).
 */
export function getStageBadgeColor(stage: PipelineStage): string {
  const colors: Record<PipelineStage, string> = {
    NEW: "bg-gray-100 text-gray-700",
    CONTACTED: "bg-blue-100 text-blue-700",
    QUALIFIED: "bg-yellow-100 text-yellow-700",
    PROPOSAL: "bg-purple-100 text-purple-700",
    WON: "bg-green-100 text-green-700",
    LOST: "bg-red-100 text-red-700",
  };
  return colors[stage];
}

/**
 * Formats a deal value with currency symbol.
 */
export function formatDealValue(value: number | null | undefined, currency = "USD"): string {
  if (!value) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
}
