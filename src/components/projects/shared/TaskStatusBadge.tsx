import { Badge } from "@/components/ui/Badge";
import type { TaskStatus } from "@/modules/projects/types";

const config: Record<
  TaskStatus,
  { label: string; variant: "gray" | "blue" | "green" }
> = {
  TODO: { label: "To Do", variant: "gray" },
  IN_PROGRESS: { label: "In Progress", variant: "blue" },
  DONE: { label: "Done", variant: "green" },
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const c = config[status];
  return <Badge variant={c.variant}>{c.label}</Badge>;
}
