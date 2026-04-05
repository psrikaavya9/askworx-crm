"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle, Receipt, ExternalLink, AlertTriangle, Flag } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { ExpenseStatusBadge } from "@/components/finance/shared/ExpenseStatusBadge";
import { RejectReasonModal } from "@/components/finance/RejectReasonModal";
import { toast } from "@/components/ui/Toaster";
import { useApiClient } from "@/lib/api-client";
import { formatDate, formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { ExpenseWithStaff } from "@/modules/finance/types";

interface PaginatedExpenses {
  data: ExpenseWithStaff[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface Props {
  data: PaginatedExpenses;
  onPageChange: (page: number) => void;
}

export function OwnerExpenses({ data, onPageChange }: Props) {
  const router = useRouter();
  const api = useApiClient();

  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ExpenseWithStaff | null>(null);

  async function handleApprove(expense: ExpenseWithStaff) {
    setApprovingId(expense.id);
    try {
      await api.patch(`/api/expenses/${expense.id}/approve`);
      toast.success("Expense approved", `₹${Number(expense.amount).toLocaleString("en-IN")} approved`);
      router.refresh();
    } catch (err) {
      toast.error("Approval failed", err instanceof Error ? err.message : "Please try again");
    } finally {
      setApprovingId(null);
    }
  }

  async function handleRejectConfirm(reason: string) {
    if (!rejectTarget) return;
    await api.patch(`/api/expenses/${rejectTarget.id}/reject`, { rejectionReason: reason });
    toast.success("Expense rejected", "Rejection reason recorded");
    router.refresh();
  }

  const staffName = (expense: ExpenseWithStaff) =>
    expense.staff
      ? `${expense.staff.firstName} ${expense.staff.lastName}`
      : "—";

  return (
    <>
      {/* Flagged legend */}
      {data.data.some((e) => e.isFlagged) && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800">
          <Flag className="h-4 w-4 shrink-0 text-amber-600" />
          <span>
            <strong>Flagged rows</strong> are highlighted — GPS mismatch or missing receipt detected
            by the validation engine.
          </span>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-md">
        {data.data.length === 0 ? (
          <EmptyState
            icon={<Receipt className="h-6 w-6" />}
            title="All clear"
            description="No expenses pending owner review."
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Employee
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Date
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Category
                </th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Amount
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Flag Reason
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Receipt
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Status
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.data.map((expense) => (
                <tr
                  key={expense.id}
                  className={cn(
                    "transition-colors",
                    expense.isFlagged
                      ? "bg-amber-50/60 hover:bg-amber-50"
                      : "bg-white hover:bg-gray-50"
                  )}
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5">
                      {expense.isFlagged && (
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      )}
                      <span className="font-medium text-gray-900">{staffName(expense)}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-gray-500">{formatDate(expense.date)}</td>
                  <td className="px-5 py-4">
                    <span className="rounded-lg bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-gray-200">
                      {expense.category}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right font-semibold text-gray-900">
                    {formatCurrency(Number(expense.amount), "INR")}
                  </td>
                  <td className="px-5 py-4 max-w-[220px]">
                    {expense.flagReason ? (
                      <span
                        title={expense.flagReason}
                        className="block truncate text-xs text-amber-700 font-medium"
                      >
                        {expense.flagReason}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {expense.receiptUrl ? (
                      <a
                        href={expense.receiptUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 text-xs font-medium transition-colors"
                      >
                        View <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-gray-400 text-xs">No receipt</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <ExpenseStatusBadge status={expense.status} />
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={approvingId === expense.id}
                        onClick={() => handleApprove(expense)}
                        icon={<CheckCircle className="h-3.5 w-3.5 text-emerald-600" />}
                        className="text-emerald-700 hover:bg-emerald-50 ring-1 ring-emerald-200"
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={approvingId === expense.id}
                        onClick={() => setRejectTarget(expense)}
                        icon={<XCircle className="h-3.5 w-3.5 text-red-500" />}
                        className="text-red-600 hover:bg-red-50 ring-1 ring-red-200"
                      >
                        Reject
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data.totalPages > 1 && (
        <Pagination
          page={data.page}
          totalPages={data.totalPages}
          total={data.total}
          pageSize={data.pageSize}
          onPageChange={onPageChange}
        />
      )}

      <RejectReasonModal
        open={rejectTarget !== null}
        onClose={() => setRejectTarget(null)}
        onConfirm={handleRejectConfirm}
        expenseLabel={
          rejectTarget
            ? `${staffName(rejectTarget)} — ${rejectTarget.category} — ₹${Number(rejectTarget.amount).toLocaleString("en-IN")}`
            : undefined
        }
      />
    </>
  );
}
