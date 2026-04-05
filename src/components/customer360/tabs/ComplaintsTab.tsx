import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  MessageSquareWarning,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import type { C360Complaint } from "../types";

// ---------------------------------------------------------------------------
// Badge configs
// ---------------------------------------------------------------------------

const PRIORITY_CONFIG = {
  LOW:      { label: "Low",      variant: "gray"   as const },
  MEDIUM:   { label: "Medium",   variant: "yellow" as const },
  HIGH:     { label: "High",     variant: "orange" as const },
  CRITICAL: { label: "Critical", variant: "red"    as const },
};

const STATUS_CONFIG = {
  OPEN:        { label: "Open",        variant: "red"    as const, icon: <XCircle     className="h-3.5 w-3.5" /> },
  IN_PROGRESS: { label: "In Progress", variant: "yellow" as const, icon: <Clock       className="h-3.5 w-3.5" /> },
  RESOLVED:    { label: "Resolved",    variant: "green"  as const, icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  CLOSED:      { label: "Closed",      variant: "gray"   as const, icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  complaints: C360Complaint[];
}

export function ComplaintsTab({ complaints }: Props) {
  if (complaints.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
          <CheckCircle2 className="h-7 w-7 text-emerald-500" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-700">No complaints</p>
          <p className="mt-1 text-xs text-gray-400">
            This client has no recorded complaints — great relationship!
          </p>
        </div>
      </div>
    );
  }

  const openCount     = complaints.filter((c) => c.status === "OPEN").length;
  const resolvedCount = complaints.filter((c) =>
    c.status === "RESOLVED" || c.status === "CLOSED"
  ).length;
  const criticalCount = complaints.filter((c) => c.priority === "CRITICAL").length;

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div
          className={`rounded-xl border px-4 py-3 ${
            openCount > 0 ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"
          }`}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Open
          </p>
          <p className={`mt-1 text-xl font-bold ${openCount > 0 ? "text-red-600" : "text-gray-900"}`}>
            {openCount}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Resolved
          </p>
          <p className="mt-1 text-xl font-bold text-emerald-600">{resolvedCount}</p>
        </div>
        <div
          className={`rounded-xl border px-4 py-3 ${
            criticalCount > 0 ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"
          }`}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Critical
          </p>
          <p className={`mt-1 text-xl font-bold ${criticalCount > 0 ? "text-red-700" : "text-gray-900"}`}>
            {criticalCount}
          </p>
        </div>
      </div>

      {/* Critical alert */}
      {criticalCount > 0 && (
        <div className="flex items-center gap-2.5 rounded-xl border border-red-300 bg-red-50 px-4 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
          <p className="text-sm font-medium text-red-700">
            {criticalCount} critical complaint{criticalCount > 1 ? "s" : ""} require immediate attention.
          </p>
        </div>
      )}

      {/* Complaints list */}
      <div className="space-y-3">
        {complaints.map((complaint) => {
          const priorityCfg = PRIORITY_CONFIG[complaint.priority];
          const statusCfg   = STATUS_CONFIG[complaint.status];

          return (
            <div
              key={complaint.id}
              className={`rounded-xl border bg-white p-4 shadow-sm ${
                complaint.priority === "CRITICAL" && complaint.status === "OPEN"
                  ? "border-red-300"
                  : "border-gray-200"
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`flex items-center gap-1 text-xs font-semibold ${
                      statusCfg.variant === "green"
                        ? "text-emerald-600"
                        : statusCfg.variant === "yellow"
                        ? "text-amber-600"
                        : statusCfg.variant === "red"
                        ? "text-red-600"
                        : "text-gray-500"
                    }`}
                  >
                    {statusCfg.icon}
                    {statusCfg.label}
                  </span>
                  <span className="text-gray-300">·</span>
                  <Badge variant={priorityCfg.variant}>{priorityCfg.label}</Badge>
                </div>
                <span className="shrink-0 text-xs text-gray-400">
                  {formatDate(complaint.createdAt)}
                </span>
              </div>

              {/* Description */}
              <p className="mt-2.5 text-sm leading-relaxed text-gray-700">
                {complaint.description}
              </p>

              {/* Resolution */}
              {complaint.resolution && (
                <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-600">
                    Resolution
                  </p>
                  <p className="text-xs text-emerald-700">{complaint.resolution}</p>
                </div>
              )}

              {/* Footer */}
              {complaint.resolvedAt && (
                <p className="mt-2.5 text-xs text-gray-400">
                  Resolved on {formatDate(complaint.resolvedAt)}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
