import { Suspense } from "react";
import { findExpenses } from "@/modules/finance/repositories/expense.repository";
import { expenseFiltersSchema } from "@/modules/finance/schemas/expense.schema";
import { ExpensesTable } from "@/components/finance/ExpensesTable";
import { StatCard } from "@/components/ui/Card";
import { SectionBlock } from "@/components/ui/SectionBlock";
import { Receipt, Clock, CheckCircle, XCircle, ShoppingCart } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { serializePrisma } from "@/lib/serialize";

interface PageProps {
  searchParams: Promise<Record<string, string>>;
}

async function ExpenseKPIs() {
  const [pending, approved, rejected, totalApprovedAmt] = await Promise.all([
    prisma.expense.count({ where: { status: "PENDING" } }),
    prisma.expense.count({ where: { status: "APPROVED" } }),
    prisma.expense.count({ where: { status: "REJECTED" } }),
    prisma.expense.aggregate({ where: { status: "APPROVED" }, _sum: { amount: true } }),
  ]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="grid grid-cols-4 gap-6">
      <StatCard
        label="Total Approved"
        value={fmt(Number(totalApprovedAmt._sum.amount ?? 0))}
        sub={`${approved} expenses`}
        icon={<Receipt className="h-5 w-5" />}
        color="indigo"
      />
      <StatCard label="Pending Approval" value={pending} icon={<Clock className="h-5 w-5" />} color={pending > 0 ? "yellow" : "green"} />
      <StatCard label="Approved" value={approved} icon={<CheckCircle className="h-5 w-5" />} color="green" />
      <StatCard label="Rejected" value={rejected} icon={<XCircle className="h-5 w-5" />} color={rejected > 0 ? "red" : "indigo"} />
    </div>
  );
}

export default async function ExpensesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = expenseFiltersSchema.parse(params);
  const data = await findExpenses(filters);

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-8 py-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
        <p className="mt-1 text-sm text-gray-500">Review, approve, and manage company expenses</p>
      </div>

      {/* KPI Section */}
      <SectionBlock
        title="Expense Summary"
        subtitle="Approval status and total spend across all categories"
        icon={<ShoppingCart className="h-4.5 w-4.5 text-orange-600" />}
        href="/finance/invoices"
        hrefLabel="View invoices"
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
          <ExpenseKPIs />
        </Suspense>
      </SectionBlock>

      {/* Table Section */}
      <SectionBlock
        title="All Expenses"
        subtitle="Submit, review, and approve expense claims"
        icon={<Receipt className="h-4.5 w-4.5 text-orange-600" />}
      >
        <ExpensesTable data={serializePrisma(data) as never} />
      </SectionBlock>
    </div>
  );
}
