import { cn } from "@/lib/utils";
import { ShieldCheck, AlertTriangle } from "lucide-react";
import type { HealthStatus } from "@/lib/services/healthScore";

// ---------------------------------------------------------------------------
// Breakdown scores (optional — shown as mini metric bars inside the card)
// ---------------------------------------------------------------------------

export interface BreakdownScores {
  paymentScore:     number;
  engagementScore:  number;
  interactionScore: number;
  complaintScore:   number;
  revenueScore:     number;
}

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

type StatusConfig = {
  scoreTxt:    string;
  statusBg:    string;
  statusTxt:   string;
  cardBg:      string;
  cardBorder:  string;
  bar:         string;
  iconBg:      string;
  iconTxt:     string;
  description: string;
};

const STATUS_CONFIG: Record<HealthStatus, StatusConfig> = {
  Healthy: {
    scoreTxt:    "text-emerald-700",
    statusBg:    "bg-emerald-100",
    statusTxt:   "text-emerald-700",
    cardBg:      "bg-emerald-50/60",
    cardBorder:  "border-emerald-200",
    bar:         "bg-emerald-500",
    iconBg:      "bg-emerald-100",
    iconTxt:     "text-emerald-600",
    description: "Strong engagement, payments on track.",
  },
  Stable: {
    scoreTxt:    "text-yellow-700",
    statusBg:    "bg-yellow-100",
    statusTxt:   "text-yellow-700",
    cardBg:      "bg-yellow-50/60",
    cardBorder:  "border-yellow-200",
    bar:         "bg-yellow-500",
    iconBg:      "bg-yellow-100",
    iconTxt:     "text-yellow-600",
    description: "Generally healthy — monitor for changes.",
  },
  "At Risk": {
    scoreTxt:    "text-orange-700",
    statusBg:    "bg-orange-100",
    statusTxt:   "text-orange-700",
    cardBg:      "bg-orange-50/60",
    cardBorder:  "border-orange-200",
    bar:         "bg-orange-500",
    iconBg:      "bg-orange-100",
    iconTxt:     "text-orange-600",
    description: "Needs attention — review recent activity.",
  },
  Critical: {
    scoreTxt:    "text-red-700",
    statusBg:    "bg-red-100",
    statusTxt:   "text-red-700",
    cardBg:      "bg-red-50/60",
    cardBorder:  "border-red-200",
    bar:         "bg-red-500",
    iconBg:      "bg-red-100",
    iconTxt:     "text-red-600",
    description: "Immediate follow-up required.",
  },
};

// ---------------------------------------------------------------------------
// Reusable status badge — also exported for use in the customers list
// ---------------------------------------------------------------------------

export function HealthBadge({
  status,
  score,
  size = "md",
}: {
  status: HealthStatus | string;
  score?: number;
  size?: "sm" | "md";
}) {
  const cfg        = STATUS_CONFIG[status as HealthStatus] ?? STATUS_CONFIG.Critical;
  const isCritical = status === "Critical";

  return (
    <span className={cn("relative inline-flex", isCritical && "group/badge")}>
      {/* Pulsing ring for Critical */}
      {isCritical && (
        <span
          className="absolute inset-0 rounded-full animate-ping bg-red-400 opacity-30"
          aria-hidden
        />
      )}
      <span
        className={cn(
          "relative inline-flex items-center gap-1 rounded-full font-semibold",
          size === "sm"
            ? "px-2 py-0.5 text-[11px]"
            : "px-3 py-1 text-xs",
          cfg.statusBg,
          cfg.statusTxt,
        )}
      >
        {score !== undefined && (
          <span className="tabular-nums">{score}</span>
        )}
        <span>{status}</span>
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Breakdown grid — five metric bars shown inside the card
// ---------------------------------------------------------------------------

const BREAKDOWN_ROWS: Array<{
  key:   keyof BreakdownScores;
  label: string;
  bar:   string;
  weight: string;
}> = [
  { key: "paymentScore",     label: "Payment",     bar: "bg-emerald-500", weight: "30%" },
  { key: "engagementScore",  label: "Engagement",  bar: "bg-blue-500",    weight: "25%" },
  { key: "interactionScore", label: "Interaction", bar: "bg-purple-500",  weight: "20%" },
  { key: "complaintScore",   label: "Complaints",  bar: "bg-amber-500",   weight: "15%" },
  { key: "revenueScore",     label: "Revenue",     bar: "bg-teal-500",    weight: "10%" },
];

function BreakdownGrid({ breakdown }: { breakdown: BreakdownScores }) {
  return (
    <div className="mt-4 grid grid-cols-1 gap-2 border-t border-black/5 pt-4 sm:grid-cols-2 lg:grid-cols-5">
      {BREAKDOWN_ROWS.map(({ key, label, bar, weight }) => {
        const value = breakdown[key];
        return (
          <div key={key} className="space-y-1">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                {label}
              </span>
              <span className="text-[10px] text-gray-400">{weight}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/10">
                <div
                  className={cn("h-full rounded-full transition-all duration-700", bar)}
                  style={{ width: `${value}%` }}
                />
              </div>
              <span className="w-6 text-right text-[11px] font-bold tabular-nums text-gray-700">
                {value}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface HealthScoreCardProps {
  score:      number | null;
  status:     HealthStatus | string | null;
  breakdown?: BreakdownScores;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HealthScoreCard({ score, status, breakdown }: HealthScoreCardProps) {
  // ── No-data state ──────────────────────────────────────────────────────────
  if (score === null || status === null) {
    return (
      <div className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white px-6 py-4 shadow-sm">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
          <ShieldCheck className="h-5 w-5 text-gray-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-500">Customer Health Score</p>
          <p className="text-xs text-gray-400">No data available yet.</p>
        </div>
      </div>
    );
  }

  const cfg       = STATUS_CONFIG[status as HealthStatus] ?? STATUS_CONFIG.Critical;
  const pct       = Math.max(0, Math.min(100, score));
  const isAtRisk  = status === "At Risk" || status === "Critical";

  return (
    <div className="space-y-2">
      {/* Main score card */}
      <div
        className={cn(
          "rounded-2xl border px-6 py-5 shadow-sm",
          cfg.cardBg,
          cfg.cardBorder,
        )}
      >
        {/* Top row: icon · label · score · badge */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          {/* Icon */}
          <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", cfg.iconBg)}>
            <ShieldCheck className={cn("h-6 w-6", cfg.iconTxt)} />
          </div>

          {/* Label */}
          <div className="min-w-0 shrink-0">
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
              Customer Health Score
            </p>
            <p className="mt-0.5 text-xs text-gray-400">{cfg.description}</p>
          </div>

          {/* Divider */}
          <div className="hidden h-10 w-px bg-gray-200 sm:block" />

          {/* Score + progress bar */}
          <div className="flex flex-1 flex-col gap-2">
            <div className="flex items-baseline gap-1.5">
              <span className={cn("text-4xl font-extrabold tabular-nums leading-none", cfg.scoreTxt)}>
                {score}
              </span>
              <span className="text-sm font-medium text-gray-400">/ 100</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/70">
              <div
                className={cn("h-full rounded-full transition-all duration-500", cfg.bar)}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Status badge */}
          <div className="sm:ml-auto">
            <HealthBadge status={status} size="md" />
          </div>
        </div>

        {/* ── Score breakdown bars — inside the card ──────────────────────── */}
        {breakdown && <BreakdownGrid breakdown={breakdown} />}
      </div>

      {/* ── Risk alert — shown only for At Risk / Critical ─────────────────── */}
      {isAtRisk && (
        <div
          className={cn(
            "flex items-start gap-3 rounded-xl border px-4 py-3",
            status === "Critical"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-orange-200 bg-orange-50 text-orange-700",
          )}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="text-sm">
            <span className="font-semibold">
              {status === "Critical" ? "Immediate action required. " : "This customer needs attention. "}
            </span>
            <span className="opacity-80">
              {status === "Critical"
                ? "Review open complaints, overdue invoices, and schedule a follow-up call."
                : "Check engagement levels, recent interactions, and any unresolved complaints."}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
