import { BarChart2 } from "lucide-react";
import { ExpenseDashboard } from "@/components/finance/ExpenseDashboard";

// ---------------------------------------------------------------------------
// Expense Analytics Dashboard
// Owner / Admin only — data is fetched client-side via authenticated API.
// ---------------------------------------------------------------------------

export default function ExpenseAnalyticsPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-8 py-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expense Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">
            Deep-dive into spend patterns, trends, employee breakdowns, and GPS heatmaps
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 border border-indigo-100">
          <BarChart2 className="h-5 w-5 text-indigo-600" />
        </div>
      </div>

      <ExpenseDashboard />
    </div>
  );
}
