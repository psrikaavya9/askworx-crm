"use client";

import { AlertTriangle, TrendingUp, Info } from "lucide-react";
import type { Insight } from "@/app/api/analytics/insights/route";

interface Props {
  insights: Insight[];
}

const CONFIG = {
  warning: {
    container: "border-red-200 bg-red-50",
    icon: <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />,
    label: "text-red-700",
    badge: "bg-red-100 text-red-600",
    badgeText: "Warning",
  },
  success: {
    container: "border-green-200 bg-green-50",
    icon: <TrendingUp className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />,
    label: "text-green-700",
    badge: "bg-green-100 text-green-600",
    badgeText: "Opportunity",
  },
  info: {
    container: "border-blue-200 bg-blue-50",
    icon: <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />,
    label: "text-blue-700",
    badge: "bg-blue-100 text-blue-600",
    badgeText: "Info",
  },
} as const;

export function InsightsPanel({ insights }: Props) {
  if (insights.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic">No insights available yet.</p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {insights.map((insight, i) => {
        const cfg = CONFIG[insight.type];
        return (
          <div
            key={i}
            className={`flex items-start gap-3 rounded-lg border p-4 ${cfg.container}`}
          >
            {cfg.icon}
            <div className="min-w-0 flex-1">
              <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold mb-1 ${cfg.badge}`}>
                {cfg.badgeText}
              </span>
              <p className={`text-sm font-medium ${cfg.label}`}>{insight.message}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
