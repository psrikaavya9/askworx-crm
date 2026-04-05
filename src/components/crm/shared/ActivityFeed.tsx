import { timeAgo } from "@/lib/utils";
import type { LeadActivity, ActivityType } from "@/modules/crm/types";
import {
  Plus, Phone, Mail, Calendar, FileText, ArrowRight, CheckCircle, XCircle,
  StickyNote, AlertTriangle, GitMerge, UserCheck,
} from "lucide-react";

const activityIcon: Record<ActivityType, React.ReactNode> = {
  LEAD_CREATED:       <Plus        className="h-3.5 w-3.5" />,
  STAGE_CHANGED:      <ArrowRight  className="h-3.5 w-3.5" />,
  NOTE_ADDED:         <StickyNote  className="h-3.5 w-3.5" />,
  EMAIL_SENT:         <Mail        className="h-3.5 w-3.5" />,
  CALL_MADE:          <Phone       className="h-3.5 w-3.5" />,
  MEETING_SCHEDULED:  <Calendar    className="h-3.5 w-3.5" />,
  MEETING_HELD:       <Calendar    className="h-3.5 w-3.5" />,
  PROPOSAL_SENT:      <FileText    className="h-3.5 w-3.5" />,
  REMINDER_SET:       <Calendar    className="h-3.5 w-3.5" />,
  REMINDER_COMPLETED: <CheckCircle className="h-3.5 w-3.5" />,
  LEAD_CONVERTED:     <CheckCircle className="h-3.5 w-3.5" />,
  LEAD_LOST:          <XCircle     className="h-3.5 w-3.5" />,
  DUPLICATE_FLAGGED:  <AlertTriangle className="h-3.5 w-3.5" />,
  LEAD_MERGED:        <GitMerge    className="h-3.5 w-3.5" />,
  LEAD_ASSIGNED:      <UserCheck   className="h-3.5 w-3.5" />,
};

const activityColor: Partial<Record<ActivityType, string>> = {
  LEAD_CREATED:      "bg-indigo-100 text-indigo-600",
  LEAD_CONVERTED:    "bg-green-100 text-green-600",
  LEAD_LOST:         "bg-red-100 text-red-600",
  STAGE_CHANGED:     "bg-blue-100 text-blue-600",
  NOTE_ADDED:        "bg-yellow-100 text-yellow-600",
  DUPLICATE_FLAGGED: "bg-orange-100 text-orange-600",
  LEAD_MERGED:       "bg-purple-100 text-purple-600",
  LEAD_ASSIGNED:     "bg-teal-100 text-teal-600",
};

export function ActivityFeed({ activities }: { activities: LeadActivity[] }) {
  if (!activities.length) {
    return <p className="py-4 text-center text-sm text-gray-400">No activity yet.</p>;
  }

  return (
    <ol className="space-y-4">
      {activities.map((act, idx) => (
        <li key={act.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full
                ${activityColor[act.type] ?? "bg-gray-100 text-gray-500"}`}
            >
              {activityIcon[act.type]}
            </div>
            {idx < activities.length - 1 && (
              <div className="mt-1 h-full w-px flex-1 bg-gray-200" />
            )}
          </div>
          <div className="pb-4 pt-0.5">
            <p className="text-sm text-gray-800">{act.description}</p>
            <p className="mt-0.5 text-xs text-gray-400">{timeAgo(act.createdAt)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
