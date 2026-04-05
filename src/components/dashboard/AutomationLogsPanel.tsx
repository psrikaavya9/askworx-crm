"use client";

import { formatDistanceToNow } from "date-fns";
import { Bell, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { AutomationLogEntry } from "@/app/api/analytics/automation-logs/route";

interface Props {
  logs: AutomationLogEntry[];
}

const ACTION_CONFIG: Record<string, {
  label: string;
  icon: React.ReactNode;
  badge: string;
  row: string;
}> = {
  FOLLOW_UP_REMINDER_CREATED: {
    label: "Follow-up reminder created",
    icon: <Bell className="h-3.5 w-3.5 text-amber-500" />,
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    row: "hover:bg-amber-50/40",
  },
  STAGE_STUCK_WARNING: {
    label: "Stage stuck warning",
    icon: <AlertTriangle className="h-3.5 w-3.5 text-red-500" />,
    badge: "bg-red-50 text-red-700 border-red-200",
    row: "hover:bg-red-50/40",
  },
};

const FALLBACK_CONFIG = {
  label: "Automation event",
  icon: <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />,
  badge: "bg-blue-50 text-blue-700 border-blue-200",
  row: "hover:bg-blue-50/40",
};

export function AutomationLogsPanel({ logs }: Props) {
  if (logs.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic">
        No automation events yet. Events appear here once the cron runs.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              Rule
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              Lead
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              Stage
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              Detail
            </th>
            <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
              When
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {logs.map((log) => {
            const cfg = ACTION_CONFIG[log.action] ?? FALLBACK_CONFIG;
            const meta = log.metadata;
            const leadName = String(meta.leadName ?? "—");
            const stage = String(meta.stage ?? "—");
            const detail =
              log.action === "FOLLOW_UP_REMINDER_CREATED"
                ? `${meta.daysSinceLastActivity ?? "?"} days no activity`
                : log.action === "STAGE_STUCK_WARNING"
                ? `${meta.daysStuck ?? "?"} days in stage`
                : "—";

            return (
              <tr key={log.id} className={`transition-colors ${cfg.row}`}>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${cfg.badge}`}>
                    {cfg.icon}
                    {cfg.label}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium text-gray-800">{leadName}</td>
                <td className="px-4 py-3 text-gray-500">{stage}</td>
                <td className="px-4 py-3 text-gray-500">{detail}</td>
                <td className="px-4 py-3 text-right text-xs text-gray-400">
                  {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
