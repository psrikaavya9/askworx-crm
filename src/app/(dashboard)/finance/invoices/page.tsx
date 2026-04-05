import { Suspense } from "react";
import { findInvoices } from "@/modules/finance/repositories/invoice.repository";
import { invoiceFiltersSchema } from "@/modules/finance/schemas/invoice.schema";
import { getFinanceKPI } from "@/modules/finance/services/expense.service";
import { InvoicesTable } from "@/components/finance/InvoicesTable";
import { StatCard } from "@/components/ui/Card";
import { SectionBlock } from "@/components/ui/SectionBlock";
import { DollarSign, FileText, AlertCircle, TrendingUp, Wallet } from "lucide-react";
import { serializePrisma } from "@/lib/serialize";

interface PageProps {
  searchParams: Promise<Record<string, string>>;
}

async function FinanceKPIs() {
  const kpi = await getFinanceKPI();

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="grid grid-cols-4 gap-6">
      <StatCard
        label="Total Revenue"
        value={fmt(kpi.totalRevenue)}
        sub={`${kpi.paidInvoicesCount} paid invoices`}
        icon={<DollarSign className="h-5 w-5" />}
        color="green"
      />
      <StatCard
        label="Outstanding"
        value={fmt(kpi.outstandingInvoices)}
        sub={`${kpi.overdueInvoicesCount} overdue`}
        icon={<FileText className="h-5 w-5" />}
        color={kpi.overdueInvoicesCount > 0 ? "red" : "indigo"}
      />
      <StatCard
        label="Total Expenses"
        value={fmt(kpi.totalExpenses)}
        sub={`${kpi.pendingExpensesCount} pending approval`}
        icon={<AlertCircle className="h-5 w-5" />}
        color="yellow"
      />
      <StatCard
        label="Net Profit"
        value={fmt(kpi.netProfit)}
        icon={<TrendingUp className="h-5 w-5" />}
        color={kpi.netProfit >= 0 ? "green" : "red"}
      />
    </div>
  );
}

export default async function InvoicesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = invoiceFiltersSchema.parse(params);
  const data = await findInvoices(filters);

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-8 py-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
        <p className="mt-1 text-sm text-gray-500">Track payments, outstanding balances, and billing history</p>
      </div>

      {/* KPI Section */}
      <SectionBlock
        title="Finance Overview"
        subtitle="Revenue collected, outstanding amounts, and net profit"
        icon={<Wallet className="h-4.5 w-4.5 text-emerald-600" />}
        href="/finance/expenses"
        hrefLabel="View expenses"
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
          <FinanceKPIs />
        </Suspense>
      </SectionBlock>

      {/* Table Section */}
      <SectionBlock
        title="All Invoices"
        subtitle="View and manage all invoices across clients and projects"
        icon={<FileText className="h-4.5 w-4.5 text-emerald-600" />}
      >
        <InvoicesTable data={serializePrisma(data) as never} />
      </SectionBlock>
    </div>
  );
}
