import { findClients } from "@/modules/crm/repositories/client.repository";
import { clientFiltersSchema } from "@/modules/crm/schemas/client.schema";
import { ClientsTable } from "@/components/crm/clients/ClientsTable";
import { StatCard } from "@/components/ui/Card";
import { SectionBlock } from "@/components/ui/SectionBlock";
import { prisma } from "@/lib/prisma";
import { UserCheck, Users } from "lucide-react";
import { serializePrisma } from "@/lib/serialize";

interface PageProps {
  searchParams: Promise<Record<string, string>>;
}

export default async function ClientsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = clientFiltersSchema.parse(params);
  const [data, total] = await Promise.all([
    findClients(filters),
    prisma.client.count(),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-8 py-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your converted clients and their details</p>
      </div>

      {/* KPI Section */}
      <SectionBlock
        title="Client Overview"
        subtitle="Clients automatically promoted from won leads"
        icon={<UserCheck className="h-4.5 w-4.5 text-green-600" />}
        href="/crm/leads"
        hrefLabel="View leads"
      >
        <div className="grid grid-cols-4 gap-6">
          <StatCard label="Total Clients" value={total}
            icon={<UserCheck className="h-5 w-5" />} color="green" />
        </div>
      </SectionBlock>

      {/* Table Section */}
      <SectionBlock
        title="All Clients"
        subtitle="Clients converted from won leads"
        icon={<Users className="h-4.5 w-4.5 text-green-600" />}
      >
        <ClientsTable data={serializePrisma(data)} />
      </SectionBlock>
    </div>
  );
}
