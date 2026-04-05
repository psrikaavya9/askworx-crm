import { Suspense } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { findExpenses } from "@/modules/finance/repositories/expense.repository";
import { expenseFiltersSchema } from "@/modules/finance/schemas/expense.schema";
import { OwnerExpenses } from "@/components/finance/OwnerExpenses";
import { SectionBlock } from "@/components/ui/SectionBlock";
import { StatCard } from "@/components/ui/Card";
import { Receipt, Clock, AlertTriangle, CheckCircle } from "lucide-react";
import { serializePrisma } from "@/lib/serialize";

// ---------------------------------------------------------------------------
// Owner Approval Queue — accessible by OWNER only.
//
// Shows high-value (>₹2,000) and flagged expenses.
// Flagged rows are highlighted in the client component.
// ---------------------------------------------------------------------------

interface PageProps {
  searchParams: Promise<Record<string, string>>;
}

async function OwnerKPIs() {
  const [pending, flagged, approvedToday] = await Promise.all([
    prisma.expense.count({ where: { status: "PENDING_OWNER" } }),
    prisma.expense.count({ where: { status: "PENDING_OWNER", isFlagged: true } }),
    prisma.expense.count({
      where: {
        status: "APPROVED",
        approvedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    }),
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
        label="Flagged"
        value={flagged}
        icon={<AlertTriangle className="h-5 w-5" />}
        color={flagged > 0 ? "red" : "green"}
        sub="GPS or receipt issues"
      />
      <StatCard
        label="Approved Today"
        value={approvedToday}
        icon={<CheckCircle className="h-5 w-5" />}
        color="green"
      />
    </div>
  );
}

export default async function OwnerApprovalPage({ searchParams }: PageProps) {
  const params = await searchParams;

  // Always filter to pending_owner queue on this page
  const filters = expenseFiltersSchema.parse({ ...params, status: "PENDING_OWNER" });
  const data = await findExpenses(filters);

  async function handlePageChange(page: number) {
    "use server";
    redirect(`/finance/approvals/owner?page=${page}`);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-8 py-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Owner Review Queue</h1>
        <p className="mt-1 text-sm text-gray-500">
          High-value expenses (&gt;₹2,000) and flagged submissions requiring owner approval
        </p>
      </div>

      {/* KPI Section */}
      <SectionBlock
        title="Queue Summary"
        subtitle="Current status of the owner approval queue"
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
          <OwnerKPIs />
        </Suspense>
      </SectionBlock>

      {/* Table Section */}
      <SectionBlock
        title="Pending Owner"
        subtitle="Review flagged and high-value expenses — flagged rows are highlighted"
        icon={<Receipt className="h-4.5 w-4.5 text-orange-600" />}
      >
        <div className="flex flex-col gap-4">
          <OwnerExpenses
            data={serializePrisma(data) as never}
            onPageChange={handlePageChange}
          />
        </div>
      </SectionBlock>
    </div>
  );
}
