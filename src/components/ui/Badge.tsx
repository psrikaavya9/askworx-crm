import { cn } from "@/lib/utils";

type BadgeVariant =
  | "gray"
  | "blue"
  | "yellow"
  | "purple"
  | "green"
  | "red"
  | "indigo"
  | "orange"
  | "teal"
  | "emerald";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
  dot?: boolean;
}

const variantClasses: Record<BadgeVariant, string> = {
  gray:    "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  blue:    "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  yellow:  "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  purple:  "bg-purple-50 text-purple-700 ring-1 ring-purple-200",
  green:   "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  red:     "bg-red-50 text-red-700 ring-1 ring-red-200",
  indigo:  "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
  orange:  "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
  teal:    "bg-teal-50 text-teal-700 ring-1 ring-teal-200",
  emerald: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
};

const dotColors: Record<BadgeVariant, string> = {
  gray:    "bg-slate-500",
  blue:    "bg-blue-500",
  yellow:  "bg-amber-500",
  purple:  "bg-purple-500",
  green:   "bg-emerald-500",
  red:     "bg-red-500",
  indigo:  "bg-indigo-500",
  orange:  "bg-orange-500",
  teal:    "bg-teal-500",
  emerald: "bg-emerald-500",
};

export function Badge({ children, variant = "gray", className, dot = false }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        variantClasses[variant],
        className
      )}
    >
      {dot && (
        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", dotColors[variant])} />
      )}
      {children}
    </span>
  );
}
