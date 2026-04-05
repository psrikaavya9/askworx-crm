import { cn } from "@/lib/utils";
import type { ScoreCategory } from "@/modules/crm/types";

interface ScoreBadgeProps {
  category: ScoreCategory;
  score?: number;
  size?: "sm" | "md";
}

const CONFIG: Record<ScoreCategory, { label: string; dot: string; badge: string }> = {
  HOT:  { label: "HOT",  dot: "bg-red-500",    badge: "bg-red-50    text-red-700    ring-red-200"   },
  WARM: { label: "WARM", dot: "bg-amber-400",  badge: "bg-amber-50  text-amber-700  ring-amber-200" },
  COLD: { label: "COLD", dot: "bg-slate-400",  badge: "bg-slate-50  text-slate-600  ring-slate-200" },
};

export function ScoreBadge({ category, score, size = "sm" }: ScoreBadgeProps) {
  const { label, dot, badge } = CONFIG[category];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full ring-1 font-semibold",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
        badge
      )}
    >
      <span className={cn("rounded-full", size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2", dot)} />
      {label}
      {score !== undefined && (
        <span className="opacity-60 font-normal">{score}</span>
      )}
    </span>
  );
}
