import { cn } from "@/lib/utils";
import type { StockMovementType } from "@/generated/prisma/client";

interface MovementTypeBadgeProps {
  type: StockMovementType;
  className?: string;
}

const labels: Record<StockMovementType, string> = {
  IN: "Stock In",
  OUT: "Stock Out",
  ADJUSTMENT: "Adjustment",
};

const styles: Record<StockMovementType, string> = {
  IN: "bg-green-100 text-green-700",
  OUT: "bg-red-100 text-red-700",
  ADJUSTMENT: "bg-yellow-100 text-yellow-700",
};

export function MovementTypeBadge({ type, className }: MovementTypeBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        styles[type],
        className
      )}
    >
      {labels[type]}
    </span>
  );
}
