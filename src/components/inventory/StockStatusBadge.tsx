import { cn } from "@/lib/utils";
import type { StockStatus } from "@/modules/inventory/types";

interface StockStatusBadgeProps {
  status: StockStatus;
  className?: string;
}

export function StockStatusBadge({ status, className }: StockStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        status === "LOW_STOCK"
          ? "bg-red-100 text-red-700"
          : "bg-green-100 text-green-700",
        className
      )}
    >
      {status === "LOW_STOCK" ? "Low Stock" : "In Stock"}
    </span>
  );
}
