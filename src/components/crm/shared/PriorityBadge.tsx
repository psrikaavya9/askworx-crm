import { cn } from "@/lib/utils";
import type { LeadPriority } from "@/modules/crm/types";
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";

const config: Record<LeadPriority, { label: string; className: string; icon: React.ReactNode }> = {
  LOW: { label: "Low", className: "text-gray-500", icon: <ArrowDown className="h-3 w-3" /> },
  MEDIUM: { label: "Medium", className: "text-yellow-600", icon: <ArrowRight className="h-3 w-3" /> },
  HIGH: { label: "High", className: "text-red-600", icon: <ArrowUp className="h-3 w-3" /> },
};

export function PriorityBadge({ priority }: { priority: LeadPriority }) {
  const c = config[priority];
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", c.className)}>
      {c.icon}
      {c.label}
    </span>
  );
}
