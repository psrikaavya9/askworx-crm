import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
  hover?: boolean;
}

export function Card({ children, className, padding = true, hover = false }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-gray-200 bg-white shadow-lg",
        "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl",
        padding && "p-6",
        hover && "cursor-pointer",
        className
      )}
    >
      {children}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
  trend?: { value: number; label: string };
  color?: "indigo" | "green" | "yellow" | "red" | "purple" | "teal" | "orange";
}

/*
 * White card base for all colors.
 * Accent used only on: border-l-4, icon bg/text, sub text, trend badge.
 * Value text: dark gray. Label: muted gray.
 */
const colorConfig: Record<string, {
  accentBorder: string;
  iconBg: string;
  iconText: string;
  subText: string;
  tick: string;
}> = {
  indigo: {
    accentBorder: "border-l-blue-500",
    iconBg: "bg-blue-50",
    iconText: "text-blue-500",
    subText: "text-blue-500",
    tick: "bg-blue-400",
  },
  purple: {
    accentBorder: "border-l-purple-500",
    iconBg: "bg-purple-50",
    iconText: "text-purple-500",
    subText: "text-purple-500",
    tick: "bg-purple-400",
  },
  green: {
    accentBorder: "border-l-green-500",
    iconBg: "bg-green-50",
    iconText: "text-green-500",
    subText: "text-green-600",
    tick: "bg-green-400",
  },
  teal: {
    accentBorder: "border-l-cyan-500",
    iconBg: "bg-cyan-50",
    iconText: "text-cyan-500",
    subText: "text-cyan-600",
    tick: "bg-cyan-400",
  },
  red: {
    accentBorder: "border-l-red-500",
    iconBg: "bg-red-50",
    iconText: "text-red-500",
    subText: "text-red-500",
    tick: "bg-red-400",
  },
  yellow: {
    accentBorder: "border-l-amber-500",
    iconBg: "bg-amber-50",
    iconText: "text-amber-500",
    subText: "text-amber-600",
    tick: "bg-amber-400",
  },
  orange: {
    accentBorder: "border-l-orange-500",
    iconBg: "bg-orange-50",
    iconText: "text-orange-500",
    subText: "text-orange-500",
    tick: "bg-orange-400",
  },
};

export function StatCard({ label, value, sub, icon, trend, color = "indigo" }: StatCardProps) {
  const cfg = colorConfig[color] ?? colorConfig.indigo;

  return (
    <div
      className={cn(
        "relative rounded-xl border border-gray-200 border-l-4 bg-white shadow-lg",
        "transition-all duration-200 hover:-translate-y-1 hover:shadow-xl",
        cfg.accentBorder,
      )}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">

          {/* Text */}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              {label}
            </p>
            <p className="mt-2 text-2xl font-bold leading-none tracking-tight text-gray-900">
              {value}
            </p>
            {sub && (
              <p className={cn("mt-1.5 text-xs font-medium", cfg.subText)}>{sub}</p>
            )}
            {trend && (
              <div className={cn(
                "mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                trend.value >= 0
                  ? "bg-green-50 text-green-600"
                  : "bg-red-50 text-red-600"
              )}>
                {trend.value >= 0 ? "↑" : "↓"} {Math.abs(trend.value)}% {trend.label}
              </div>
            )}
          </div>

          {/* Icon */}
          {icon && (
            <div className={cn("shrink-0 rounded-lg p-2.5", cfg.iconBg, cfg.iconText)}>
              {icon}
            </div>
          )}
        </div>
      </div>

      {/* Bottom tick */}
      <div className={cn("absolute bottom-0 left-5 right-5 h-px rounded-full opacity-30", cfg.tick)} />
    </div>
  );
}
