import { Suspense } from "react";
import { findStaff } from "@/modules/staff/repositories/staff.repository";
import { staffFiltersSchema } from "@/modules/staff/schemas/staff.schema";
import { StaffTable } from "@/components/staff/StaffTable";
import { StatCard } from "@/components/ui/Card";
import { SectionBlock } from "@/components/ui/SectionBlock";
import { prisma } from "@/lib/prisma";
import { Users, UserCheck, UserX, ShieldCheck } from "lucide-react";
import { serializePrisma } from "@/lib/serialize";

interface PageProps {
  searchParams: Promise<Record<string, string>>;
}

async function StaffKPIs() {
  const [total, active, inactive, admins] = await Promise.all([
    prisma.staff.count(),
    prisma.staff.count({ where: { status: "ACTIVE" } }),
    prisma.staff.count({ where: { status: "INACTIVE" } }),
    prisma.staff.count({ where: { role: "ADMIN" } }),
  ]);

  return (
    <div className="grid grid-cols-4 gap-6">
      <StatCard label="Total Staff" value={total} icon={<Users className="h-5 w-5" />} color="indigo" />
      <StatCard label="Active" value={active} icon={<UserCheck className="h-5 w-5" />} color="green" />
      <StatCard label="Inactive" value={inactive} icon={<UserX className="h-5 w-5" />} color={inactive > 0 ? "yellow" : "green"} />
      <StatCard label="Admins" value={admins} icon={<ShieldCheck className="h-5 w-5" />} color="indigo" />
    </div>
  );
}

export default async function StaffPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = staffFiltersSchema.parse(params);
  const data = await findStaff(filters);

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-8 py-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Staff</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your team members, roles, and status</p>
      </div>

      {/* KPI Section */}
      <SectionBlock
        title="Workforce Summary"
        subtitle="Active headcount, roles, and staff status breakdown"
        icon={<Users className="h-4.5 w-4.5 text-teal-600" />}
        href="/attendance"
        hrefLabel="View attendance"
      >
        <Suspense
          fallback={
            <div className="grid grid-cols-4 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />
              ))}
            </div>
          }
        >
          <StaffKPIs />
        </Suspense>
      </SectionBlock>

      {/* Table Section */}
      <SectionBlock
        title="Team Members"
        subtitle="All staff records, roles, and current status"
        icon={<UserCheck className="h-4.5 w-4.5 text-teal-600" />}
      >
        <StaffTable data={serializePrisma(data) as never} />
      </SectionBlock>
    </div>
  );
}
