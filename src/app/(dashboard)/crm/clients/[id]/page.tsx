import { notFound } from "next/navigation";
import Link from "next/link";
import { findClientById } from "@/modules/crm/repositories/client.repository";
import { StageBadge } from "@/components/crm/shared/StageBadge";
import { Card } from "@/components/ui/Card";
import { formatDate, formatCurrency, getInitials } from "@/lib/utils";
import { ChevronLeft, Mail, Phone, Building2, Briefcase, Globe, MapPin } from "lucide-react";
import { LEAD_SOURCE_LABELS } from "@/modules/crm/types";

type Props = { params: Promise<{ id: string }> };

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-gray-400">{icon}</div>
      <div>
        <p className="text-[11px] text-gray-400">{label}</p>
        <p className="text-sm text-gray-800">{value}</p>
      </div>
    </div>
  );
}

export default async function ClientDetailPage({ params }: Props) {
  const { id } = await params;
  const client = await findClientById(id);
  if (!client) notFound();

  const address = [client.address, client.city, client.state, client.country]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-6">
      {/* Back */}
      <div>
        <Link href="/crm/clients" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 transition-colors">
          <ChevronLeft className="h-4 w-4" /> All Clients
        </Link>

        {/* Profile header */}
        <div className="mt-5 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-xl font-bold text-emerald-700 shadow-sm">
            {getInitials(client.firstName, client.lastName)}
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {client.firstName} {client.lastName}
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">{client.jobTitle} · {client.company}</p>
            <p className="text-xs text-gray-400 mt-0.5">Client since {formatDate(client.createdAt)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Left: Contact info */}
        <div className="space-y-4">
          <Card>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-400">Contact</h3>
            <div className="space-y-3">
              <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={client.email} />
              <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={client.phone} />
              <InfoRow icon={<Building2 className="h-4 w-4" />} label="Company" value={client.company} />
              <InfoRow icon={<Briefcase className="h-4 w-4" />} label="Job Title" value={client.jobTitle} />
              <InfoRow icon={<Globe className="h-4 w-4" />} label="Website" value={client.website} />
              {address && <InfoRow icon={<MapPin className="h-4 w-4" />} label="Address" value={address} />}
            </div>
          </Card>

          {client.notes && (
            <Card>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Notes</h3>
              <p className="text-sm text-gray-700">{client.notes}</p>
            </Card>
          )}
        </div>

        {/* Middle: Lead history */}
        <div className="col-span-2">
          <Card padding={false}>
            <div className="border-b border-gray-100 px-5 py-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Lead History ({client.leads.length})
              </h3>
            </div>
            {client.leads.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">No lead history.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50 bg-gray-50/50">
                    <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500">Lead</th>
                    <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500">Stage</th>
                    <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500">Source</th>
                    <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500">Value</th>
                    <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {client.leads.map((lead: typeof client.leads[number]) => (
                    <tr key={lead.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <Link href={`/crm/leads/${lead.id}`}
                          className="font-medium text-gray-900 hover:text-indigo-600">
                          {lead.firstName} {lead.lastName}
                        </Link>
                      </td>
                      <td className="px-5 py-3"><StageBadge stage={lead.stage} /></td>
                      <td className="px-5 py-3 text-gray-500">{LEAD_SOURCE_LABELS[lead.source]}</td>
                      <td className="px-5 py-3 font-medium text-gray-800">
                        {lead.dealValue ? formatCurrency(Number(lead.dealValue)) : "—"}
                      </td>
                      <td className="px-5 py-3 text-gray-400">{formatDate(lead.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
