import { UserCheck, Zap, TrendingUp, Calendar, Award } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import { LEAD_SOURCE_LABELS } from "@/modules/crm/types";
import type { C360Client, C360HealthScore } from "./types";
import type { LeadSource } from "@/generated/prisma/client";

interface Props {
  client: C360Client;
  healthScore: C360HealthScore | null;
}

function ScoreBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">{label}</span>
        <span className="text-xs font-semibold text-gray-700">{value}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

export function RelationshipCard({ client, healthScore }: Props) {
  const latestLead = client.leads[0];
  const sourceLabel = latestLead
    ? (LEAD_SOURCE_LABELS[latestLead.source as LeadSource] ?? latestLead.source)
    : "Unknown";

  const overallScore = healthScore?.score ?? null;
  const scoreColor =
    overallScore === null
      ? "text-gray-400"
      : overallScore >= 70
      ? "text-emerald-600"
      : overallScore >= 40
      ? "text-amber-600"
      : "text-red-600";

  const scoreBg =
    overallScore === null
      ? "bg-gray-100"
      : overallScore >= 70
      ? "bg-emerald-50 border-emerald-200"
      : overallScore >= 40
      ? "bg-amber-50 border-amber-200"
      : "bg-red-50 border-red-200";

  return (
    <Card className="space-y-5">
      <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
        Relationship
      </h3>

      <div className="space-y-4">
        {/* Lead source */}
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0 text-gray-400">
            <Zap className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Lead Source
            </p>
            <p className="mt-0.5 text-sm font-medium text-gray-800">
              {sourceLabel}
            </p>
          </div>
        </div>

        {/* Assigned engineer */}
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0 text-gray-400">
            <UserCheck className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Assigned To
            </p>
            <p className="mt-0.5 text-sm text-gray-800">
              {client.assignedTo ? (
                <span className="font-mono text-xs text-indigo-600">
                  {client.assignedTo}
                </span>
              ) : (
                <span className="text-gray-400 italic">Unassigned</span>
              )}
            </p>
          </div>
        </div>

        {/* Status derived from latest lead stage */}
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0 text-gray-400">
            <TrendingUp className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              CRM Status
            </p>
            <div className="mt-1">
              {latestLead ? (
                <Badge
                  variant={latestLead.stage === "WON" ? "green" : "blue"}
                  dot
                >
                  {latestLead.stage === "WON" ? "Active Client" : latestLead.stage}
                </Badge>
              ) : (
                <Badge variant="gray" dot>
                  Active
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Member since */}
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0 text-gray-400">
            <Calendar className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Client Since
            </p>
            <p className="mt-0.5 text-sm text-gray-800">
              {formatDate(client.createdAt)}
            </p>
          </div>
        </div>
      </div>

      {/* Health score */}
      <div
        className={`rounded-xl border p-4 ${scoreBg}`}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-gray-500" />
            <span className="text-xs font-semibold text-gray-600">
              Health Score
            </span>
          </div>
          <span className={`text-2xl font-bold ${scoreColor}`}>
            {overallScore !== null ? overallScore : "—"}
          </span>
        </div>

        {healthScore ? (
          <div className="space-y-2">
            <ScoreBar
              label="Payment"
              value={healthScore.paymentScore}
              color="bg-emerald-500"
            />
            <ScoreBar
              label="Engagement"
              value={healthScore.engagementScore}
              color="bg-blue-500"
            />
            <ScoreBar
              label="Interactions"
              value={healthScore.interactionScore}
              color="bg-purple-500"
            />
            <ScoreBar
              label="Complaints"
              value={healthScore.complaintScore}
              color="bg-amber-500"
            />
            <ScoreBar
              label="Revenue"
              value={healthScore.revenueScore}
              color="bg-teal-500"
            />
            <p className="mt-2 text-right text-[10px] text-gray-400">
              Calculated {formatDate(healthScore.calculatedAt)}
            </p>
          </div>
        ) : (
          <p className="text-xs text-gray-400">
            No score calculated yet
          </p>
        )}
      </div>
    </Card>
  );
}
