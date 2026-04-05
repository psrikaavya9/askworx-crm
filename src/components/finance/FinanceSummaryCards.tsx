"use client";

import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Receipt, IndianRupee } from "lucide-react";
import { StatCard } from "@/components/ui/Card";
import { useApiClient } from "@/lib/api-client";

interface FinanceSummary {
  totalRevenue: number;
  totalExpense: number;
  netProfit: number;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

function SummarySkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />
      ))}
    </div>
  );
}

export function FinanceSummaryCards() {
  const api = useApiClient();
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<FinanceSummary>("/api/finance/summary")
      .then(setSummary)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load summary")
      );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
        {error}
      </p>
    );
  }

  if (!summary) return <SummarySkeleton />;

  const profitPositive = summary.netProfit >= 0;

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
      <StatCard
        label="Total Revenue"
        value={fmt(summary.totalRevenue)}
        sub="Paid &amp; sent invoices"
        icon={<IndianRupee className="h-5 w-5" />}
        color="green"
      />
      <StatCard
        label="Total Expenses"
        value={fmt(summary.totalExpense)}
        sub="Approved expenses"
        icon={<Receipt className="h-5 w-5" />}
        color="orange"
      />
      <StatCard
        label="Net Profit"
        value={fmt(summary.netProfit)}
        sub={profitPositive ? "Profitable" : "Loss"}
        icon={
          profitPositive
            ? <TrendingUp className="h-5 w-5" />
            : <TrendingDown className="h-5 w-5" />
        }
        color={profitPositive ? "green" : "red"}
      />
    </div>
  );
}
