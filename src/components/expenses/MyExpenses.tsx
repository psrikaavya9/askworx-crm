"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Receipt, ExternalLink, RefreshCw, Loader2, Clock, CheckCircle2, XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate, formatCurrency } from "@/lib/utils";
import { useApiClient } from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ExpenseStatus =
  | "PENDING" | "DRAFT" | "VALIDATING" | "AUTO_REJECTED"
  | "PENDING_ACCOUNTS" | "PENDING_OWNER"
  | "APPROVED" | "REJECTED" | "REIMBURSED";

interface MyExpense {
  id:          string;
  date:        string;
  category:    string;
  amount:      string | number;
  description: string | null;
  paymentMode: string | null;
  receiptUrl:  string | null;
  status:      ExpenseStatus;
  createdAt:   string;
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_CFG: Record<ExpenseStatus, { label: string; icon: React.ReactNode; cls: string }> = {
  PENDING: {
    label: "Submitted",
    icon:  <Clock className="h-3 w-3" />,
    cls:   "bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200",
  },
  DRAFT: {
    label: "Draft",
    icon:  <Clock className="h-3 w-3" />,
    cls:   "bg-gray-50 text-gray-500 ring-1 ring-gray-200",
  },
  VALIDATING: {
    label: "Validating",
    icon:  <Clock className="h-3 w-3" />,
    cls:   "bg-gray-50 text-gray-500 ring-1 ring-gray-200",
  },
  AUTO_REJECTED: {
    label: "Auto-Rejected",
    icon:  <XCircle className="h-3 w-3" />,
    cls:   "bg-red-50 text-red-700 ring-1 ring-red-200",
  },
  PENDING_ACCOUNTS: {
    label: "Pending (Accounts)",
    icon:  <Clock className="h-3 w-3" />,
    cls:   "bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200",
  },
  PENDING_OWNER: {
    label: "Pending (Owner)",
    icon:  <Clock className="h-3 w-3" />,
    cls:   "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
  },
  APPROVED: {
    label: "Approved",
    icon:  <CheckCircle2 className="h-3 w-3" />,
    cls:   "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  },
  REJECTED: {
    label: "Rejected",
    icon:  <XCircle className="h-3 w-3" />,
    cls:   "bg-red-50 text-red-700 ring-1 ring-red-200",
  },
  REIMBURSED: {
    label: "Reimbursed",
    icon:  <CheckCircle2 className="h-3 w-3" />,
    cls:   "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  },
};

function StatusBadge({ status }: { status: ExpenseStatus }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.PENDING;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", cfg.cls)}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Payment mode label
// ---------------------------------------------------------------------------

const PAYMENT_LABELS: Record<string, string> = {
  CASH:            "Cash",
  UPI:             "UPI",
  CARD:            "Card",
  COMPANY_ACCOUNT: "Company Acct",
};

// ---------------------------------------------------------------------------
// MyExpenses
// ---------------------------------------------------------------------------

interface Props {
  /** Incremented by the parent form's onSuccess to trigger a re-fetch */
  refreshKey: number;
}

export function MyExpenses({ refreshKey }: Props) {
  const api = useApiClient();
  const [expenses, setExpenses] = useState<MyExpense[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ success: boolean; expenses: MyExpense[] }>("/api/expenses/staff");
      setExpenses(res.expenses ?? []);
    } catch (err) {
      setError((err as Error).message ?? "Failed to load expenses");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses, refreshKey]);

  // ── Empty / error / loading states ───────────────────────────────────────
  if (loading)
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading your expenses…
      </div>
    );

  if (error)
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <button
          onClick={fetchExpenses}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      </div>
    );

  if (expenses.length === 0)
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
          <Receipt className="h-6 w-6 text-gray-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-700">No expenses yet</p>
          <p className="mt-0.5 text-xs text-gray-400">Submit your first expense using the form above.</p>
        </div>
      </div>
    );

  // ── Table ─────────────────────────────────────────────────────────────────
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Date</th>
            <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Category</th>
            <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Description</th>
            <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Mode</th>
            <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Amount</th>
            <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
            <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Receipt</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {expenses.map((exp) => (
            <tr key={exp.id} className="bg-white transition-colors hover:bg-gray-50/60">

              {/* Date */}
              <td className="px-5 py-4 text-gray-500">
                {formatDate(exp.date)}
              </td>

              {/* Category */}
              <td className="px-5 py-4">
                <span className="rounded-lg bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-100">
                  {exp.category}
                </span>
              </td>

              {/* Description */}
              <td className="max-w-[180px] truncate px-5 py-4 text-gray-500">
                {exp.description ?? <span className="text-gray-300">—</span>}
              </td>

              {/* Payment mode */}
              <td className="px-5 py-4 text-gray-500">
                {exp.paymentMode
                  ? (PAYMENT_LABELS[exp.paymentMode] ?? exp.paymentMode)
                  : <span className="text-gray-300">—</span>
                }
              </td>

              {/* Amount */}
              <td className="px-5 py-4 text-right font-semibold text-gray-900">
                {formatCurrency(Number(exp.amount), "INR")}
              </td>

              {/* Status */}
              <td className="px-5 py-4">
                <StatusBadge status={exp.status} />
              </td>

              {/* Receipt */}
              <td className="px-5 py-4">
                {exp.receiptUrl ? (
                  <a
                    href={exp.receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600 ring-1 ring-gray-200 hover:bg-indigo-50 hover:text-indigo-700 hover:ring-indigo-200 transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                    View
                  </a>
                ) : (
                  <span className="text-xs text-gray-300">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Footer */}
      <div className="border-t border-gray-100 px-5 py-3">
        <p className="text-xs text-gray-400">
          {expenses.length} expense{expenses.length !== 1 ? "s" : ""}
          {" · "}Status &ldquo;Submitted&rdquo; means pending manager review
        </p>
      </div>
    </div>
  );
}
