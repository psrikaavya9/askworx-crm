import { cn } from "@/lib/utils";
import type { DocumentStatus, VideoStatus } from "@/types/vault";

type BadgeStatus = DocumentStatus | VideoStatus | "PENDING_ACK" | "ACKNOWLEDGED";

interface StatusBadgeProps {
  status: BadgeStatus;
  size?:  "sm" | "md";
}

const config: Record<BadgeStatus, { label: string; className: string; dot: string }> = {
  ACTIVE:       { label: "Active",       dot: "bg-green-500",  className: "bg-green-50 text-green-700 border-green-200" },
  ARCHIVED:     { label: "Archived",     dot: "bg-gray-400",   className: "bg-gray-100 text-gray-600 border-gray-200" },
  EXPIRED:      { label: "Expired",      dot: "bg-red-500",    className: "bg-red-50 text-red-700 border-red-200" },
  PENDING_ACK:  { label: "Pending Ack",  dot: "bg-orange-500", className: "bg-orange-50 text-orange-700 border-orange-200" },
  ACKNOWLEDGED: { label: "Acknowledged", dot: "bg-blue-500",   className: "bg-blue-50 text-blue-700 border-blue-200" },
  PROCESSING:   { label: "Processing",   dot: "bg-amber-500",  className: "bg-amber-50 text-amber-700 border-amber-200" },
  READY:        { label: "Ready",        dot: "bg-green-500",  className: "bg-green-50 text-green-700 border-green-200" },
  FAILED:       { label: "Failed",       dot: "bg-red-500",    className: "bg-red-50 text-red-700 border-red-200" },
};

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const cfg = config[status] ?? config.ARCHIVED;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-semibold",
        cfg.className,
        size === "sm"
          ? "px-2 py-0.5 text-[10px]"
          : "px-2.5 py-1 text-xs"
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
      {cfg.label}
    </span>
  );
}
