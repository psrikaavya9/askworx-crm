import { Suspense } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { findExpenses } from "@/modules/finance/repositories/expense.repository";
import { expenseFiltersSchema } from "@/modules/finance/schemas/expense.schema";
import { AccountsExpenses } from "@/components/finance/AccountsExpenses";
import { SectionBlock } from "@/components/ui/SectionBlock";
import { StatCard } from "@/components/ui/Card";
import { Receipt, Clock, CheckCircle } from "lucide-react";
import { serializePrisma } from "@/lib/serialize";

// ---------------------------------------------------------------------------
// Accounts Approval Queue — accessible by ADMIN+ only.
//
// Data is fetched server-side directly from the DB.
// The approve/reject actions in the client component go through the
// authenticated API routes which enforce role checks server-side.
// ---------------------------------------------------------------------------

interface PageProps {
  searchParams: Promise<Record<string, string>>;
}

async function AccountsKPIs() {
  const [pending, approvedToday, approvedTotal] = await Promise.all([
    prisma.expense.count({ where: { status: "PENDING_ACCOUNTS" } }),
    prisma.expense.count({
      where: {
        status: "APPROVED",
        approvedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    }),
    prisma.expense.count({ where: { status: "APPROVED" } }),
  ]);

  return (
    <div className="grid grid-cols-3 gap-6">
      <StatCard
        label="Pending Review"
        value={pending}
        icon={<Clock className="h-5 w-5" />}
        color={pending > 0 ? "yellow" : "green"}
        sub={pending === 1 ? "1 expense waiting" : `${pending} expenses waiting`}
      />
      <StatCard
        label="Approved Today"
        value={approvedToday}
        icon={<CheckCircle className="h-5 w-5" />}
        color="green"
      />
      <StatCard
        label="Total Approved"
        value={approvedTotal}
        icon={<Receipt className="h-5 w-5" />}
        color="indigo"
      />
    </div>
  );
}

export default async function AccountsApprovalPage({ searchParams }: PageProps) {
  const params = await searchParams;

  // Always filter to pending_accounts queue on this page
  const filters = expenseFiltersSchema.parse({ ...params, status: "PENDING_ACCOUNTS" });
  const data = await findExpenses(filters);

  // page param for client-side pagination redirect
  const currentPage = filters.page;

  async function handlePageChange(page: number) {
    "use server";
    redirect(`/finance/approvals/accounts?page=${page}`);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-8 py-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Accounts Review Queue</h1>
          <p className="mt-1 text-sm text-gray-500">
            Expenses between ₹500–₹2,000 awaiting accounts team approval
          </p>
        </div>
      </div>

      {/* KPI Section */}
      <SectionBlock
        title="Queue Summary"
        subtitle="Current status of the accounts approval queue"
        icon={<Clock className="h-4.5 w-4.5 text-yellow-600" />}
      >
        <Suspense
          fallback={
            <div className="grid grid-cols-3 gap-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />
              ))}
            </div>
          }
        >
          <AccountsKPIs />
        </Suspense>
      </SectionBlock>

      {/* Table Section */}
      <SectionBlock
        title={`Pending Accounts`}
        subtitle="Review each expense and approve or reject with a reason"
        icon={<Receipt className="h-4.5 w-4.5 text-orange-600" />}
      >
        <AccountsExpenses
          data={serializePrisma(data) as never}
          onPageChange={handlePageChange}
        />
      </SectionBlock>
    </div>
  );
}
