import { notFound } from "next/navigation";
import Link from "next/link";
import { findLeadById } from "@/modules/crm/repositories/lead.repository";
import { serializePrisma } from "@/lib/serialize";
import { StageBadge } from "@/components/crm/shared/StageBadge";
import { PriorityBadge } from "@/components/crm/shared/PriorityBadge";
import { StageProgressBar } from "@/components/crm/leads/StageProgressBar";
import { LeadNotes } from "@/components/crm/leads/LeadNotes";
import { LeadReminders } from "@/components/crm/leads/LeadReminders";
import { LeadTimeline } from "@/components/crm/leads/LeadTimeline";
import { Card } from "@/components/ui/Card";
import { formatDate, formatCurrency } from "@/lib/utils";
import {
  ChevronLeft, Mail, Phone, Building2, Briefcase, Globe,
  DollarSign, Calendar, Tag,
} from "lucide-react";
import { LEAD_SOURCE_LABELS } from "@/modules/crm/types";
import { LeadActions } from "@/components/crm/leads/LeadActions";

type Props = { params: Promise<{ id: string }> };

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-gray-400">{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] text-gray-400">{label}</p>
        <p className="text-sm text-gray-800">{value}</p>
      </div>
    </div>
  );
}

export default async function LeadDetailPage({ params }: Props) {
  const { id } = await params;
  const rawLead = await findLeadById(id);
  if (!rawLead) notFound();
  const lead = serializePrisma(rawLead);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 space-y-7">
      {/* Back + header */}
      <div>
        <Link href="/crm/leads" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 transition-colors">
          <ChevronLeft className="h-4 w-4" /> All Leads
        </Link>
        <div className="mt-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {lead.firstName} {lead.lastName}
            </h1>
            <p className="mt-1 text-sm text-gray-500">{lead.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <PriorityBadge priority={lead.priority} />
            <StageBadge stage={lead.stage} />
            <div className="ml-2 flex items-center gap-2">
              <LeadActions lead={lead} />
            </div>
          </div>
        </div>
        <div className="mt-5">
          <StageProgressBar leadId={lead.id} currentStage={lead.stage} />
        </div>
      </div>

      {/* 3-column layout */}
      <div className="grid grid-cols-3 gap-5">
        {/* Left: Lead info */}
        <div className="col-span-1 space-y-4">
          <Card>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-400">Contact Info</h3>
            <div className="space-y-3">
              <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={lead.email} />
              <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={lead.phone} />
              <InfoRow icon={<Building2 className="h-4 w-4" />} label="Company" value={lead.company} />
              <InfoRow icon={<Briefcase className="h-4 w-4" />} label="Job Title" value={lead.jobTitle} />
            </div>
          </Card>

          <Card>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Deal Info</h3>
            <div className="space-y-3">
              <InfoRow icon={<DollarSign className="h-4 w-4" />} label="Deal Value"
                value={lead.dealValue ? formatCurrency(Number(lead.dealValue)) : undefined} />
              <InfoRow icon={<Globe className="h-4 w-4" />} label="Source"
                value={LEAD_SOURCE_LABELS[lead.source]} />
              <InfoRow icon={<Tag className="h-4 w-4" />} label="Source Detail" value={lead.sourceDetail} />
              <InfoRow icon={<Calendar className="h-4 w-4" />} label="Created"
                value={formatDate(lead.createdAt)} />
              {lead.convertedAt && (
                <InfoRow icon={<Calendar className="h-4 w-4" />} label="Won On"
                  value={formatDate(lead.convertedAt)} />
              )}
              {lead.lostAt && (
                <InfoRow icon={<Calendar className="h-4 w-4" />} label="Lost On"
                  value={formatDate(lead.lostAt)} />
              )}
              {lead.lostReason && (
                <InfoRow icon={<Tag className="h-4 w-4" />} label="Lost Reason" value={lead.lostReason} />
              )}
            </div>
          </Card>

          {lead.client && (
            <Card>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Client Profile</h3>
              <Link href={`/crm/clients/${lead.client.id}`}
                className="text-sm font-medium text-indigo-600 hover:underline">
                View Client → {lead.client.firstName} {lead.client.lastName}
              </Link>
            </Card>
          )}
        </div>

        {/* Middle: Notes + Reminders */}
        <div className="col-span-1 space-y-4">
          <Card>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Notes</h3>
            <LeadNotes leadId={lead.id} notes={lead.notes} />
          </Card>

          <Card padding={false} className="p-4">
            <LeadReminders leadId={lead.id} reminders={lead.reminders} />
          </Card>
        </div>

        {/* Right: Timeline */}
        <div className="col-span-1">
          <Card>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Timeline</h3>
            <LeadTimeline leadId={lead.id} />
          </Card>
        </div>
      </div>
    </div>
  );
}
