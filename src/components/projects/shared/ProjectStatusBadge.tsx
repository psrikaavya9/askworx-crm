import { Badge } from "@/components/ui/Badge";
import type { ProjectStatus } from "@/modules/projects/types";

const config: Record<
  ProjectStatus,
  { label: string; variant: "gray" | "blue" | "yellow" | "green" | "purple" }
> = {
  PLANNING: { label: "Planning", variant: "gray" },
  ACTIVE: { label: "Active", variant: "blue" },
  ON_HOLD: { label: "On Hold", variant: "yellow" },
  COMPLETED: { label: "Completed", variant: "green" },
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const c = config[status];
  return <Badge variant={c.variant}>{c.label}</Badge>;
}
