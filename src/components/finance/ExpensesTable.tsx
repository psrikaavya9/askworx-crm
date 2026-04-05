"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Plus, Search, Receipt, CheckCircle, XCircle, Banknote, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { ExpenseStatusBadge } from "@/components/finance/shared/ExpenseStatusBadge";
import { AddExpenseModal } from "@/components/finance/AddExpenseModal";
import { formatDate, formatCurrency } from "@/lib/utils";
import { useApiClient } from "@/lib/api-client";
import { toast } from "@/components/ui/Toaster";
import type { ExpenseWithStaff } from "@/modules/finance/types";

interface PaginatedExpenses {
  data: ExpenseWithStaff[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function ExpensesTable({ data }: { data: PaginatedExpenses }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const api = useApiClient();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [showAddModal, setShowAddModal] = useState(false);
  const [reimbursingIds, setReimbursingIds] = useState<Set<string>>(new Set());

  function updateParams(updates: Record<string, string | number>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === "" || v === undefined) params.delete(k);
      else params.set(k, String(v));
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    updateParams({ search, page: 1 });
  }

  async function handleApprove(id: string) {
    await fetch(`/api/expenses/${id}/approve`, { method: "PATCH" });
    router.refresh();
  }

  async function handleReject(id: string) {
    await fetch(`/api/expenses/${id}/reject`, { method: "PATCH" });
    router.refresh();
  }

  async function handleReimburse(id: string) {
    setReimbursingIds((prev) => new Set(prev).add(id));
    try {
      await api.patch(`/api/expenses/${id}/reimburse`);
      toast.success("Reimbursement processed", "Expense has been marked as reimbursed.");
      router.refresh();
    } catch (err: unknown) {
      toast.error(
        "Reimbursement failed",
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setReimbursingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <form onSubmit={handleSearch} className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search expenses..."
              className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-colors"
            />
          </form>

          <select
            value={searchParams.get("status") ?? ""}
            onChange={(e) => updateParams({ status: e.target.value, page: 1 })}
            className="rounded-lg border border-gray-300 bg-white py-2.5 pl-3 pr-8 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-colors"
          >
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <div className="ml-auto">
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setShowAddModal(true)}>
              Add Expense
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-md">
          {data.data.length === 0 ? (
            <EmptyState
              icon={<Receipt className="h-6 w-6" />}
              title="No expenses yet"
              description="Track your first expense to get started."
              action={
                <Button icon={<Plus className="h-4 w-4" />} onClick={() => setShowAddModal(true)}>
                  Add Expense
                </Button>
              }
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Date</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Category</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Description</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Staff</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Amount</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.data.map((expense) => (
                  <tr key={expense.id} className="group bg-white transition-colors hover:bg-gray-50">
                    <td className="px-5 py-4 text-gray-500">{formatDate(expense.date)}</td>
                    <td className="px-5 py-4">
                      <span className="rounded-lg bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-gray-200">
                        {expense.category}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-500 max-w-[200px] truncate">
                      {expense.description ?? "—"}
                    </td>
                    <td className="px-5 py-4 text-gray-500">
                      {expense.staff
                        ? `${expense.staff.firstName} ${expense.staff.lastName}`
                        : "—"}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold text-gray-900">
                      {formatCurrency(Number(expense.amount), "INR")}
                    </td>
                    <td className="px-5 py-4">
                      <ExpenseStatusBadge status={expense.status} />
                      {expense.status === "REIMBURSED" && expense.reimbursedAt && (
                        <p className="mt-1 text-[11px] text-gray-400">
                          {formatDate(expense.reimbursedAt)}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {expense.status === "PENDING" && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleApprove(expense.id)}
                            className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors ring-1 ring-emerald-200"
                          >
                            <CheckCircle className="h-3 w-3" />
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(expense.id)}
                            className="flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors ring-1 ring-red-200"
                          >
                            <XCircle className="h-3 w-3" />
                            Reject
                          </button>
                        </div>
                      )}
                      {expense.status === "APPROVED" && (
                        <button
                          onClick={() => handleReimburse(expense.id)}
                          disabled={reimbursingIds.has(expense.id)}
                          className="flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200 transition-colors hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {reimbursingIds.has(expense.id) ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Banknote className="h-3 w-3" />
                          )}
                          {reimbursingIds.has(expense.id) ? "Processing…" : "Mark Reimbursed"}
                        </button>
                      )}
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
            onPageChange={(p) => updateParams({ page: p })}
          />
        )}
      </div>

      <AddExpenseModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCreated={() => router.refresh()}
      />
    </>
  );
}
