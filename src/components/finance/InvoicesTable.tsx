"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { Plus, Search, FileText } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { InvoiceStatusBadge } from "@/components/finance/shared/InvoiceStatusBadge";
import { CreateInvoiceModal } from "@/components/finance/CreateInvoiceModal";
import { formatDate, formatCurrency } from "@/lib/utils";
import type { InvoiceWithItems } from "@/modules/finance/types";

interface PaginatedInvoices {
  data: InvoiceWithItems[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function InvoicesTable({ data }: { data: PaginatedInvoices }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [showCreateModal, setShowCreateModal] = useState(false);

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
              placeholder="Search invoice number..."
              className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-colors"
            />
          </form>

          <select
            value={searchParams.get("status") ?? ""}
            onChange={(e) => updateParams({ status: e.target.value, page: 1 })}
            className="rounded-lg border border-gray-300 bg-white py-2.5 pl-3 pr-8 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-colors"
          >
            <option value="">All Status</option>
            <option value="DRAFT">Draft</option>
            <option value="SENT">Sent</option>
            <option value="PAID">Paid</option>
            <option value="OVERDUE">Overdue</option>
          </select>

          <div className="ml-auto">
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setShowCreateModal(true)}>
              New Invoice
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-md">
          {data.data.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title="No invoices yet"
              description="Create your first invoice to get started."
              action={
                <Button icon={<Plus className="h-4 w-4" />} onClick={() => setShowCreateModal(true)}>
                  New Invoice
                </Button>
              }
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Invoice #</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Client</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Issue Date</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Due Date</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Amount</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.data.map((invoice) => (
                  <tr key={invoice.id} className="group bg-white transition-colors hover:bg-gray-50">
                    <td className="px-5 py-4">
                      <Link
                        href={`/finance/invoices/${invoice.id}`}
                        className="font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                      >
                        {invoice.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-gray-700">
                      {invoice.client
                        ? `${invoice.client.firstName} ${invoice.client.lastName} · ${invoice.client.company}`
                        : "—"}
                    </td>
                    <td className="px-5 py-4 text-gray-500">{formatDate(invoice.issueDate)}</td>
                    <td className="px-5 py-4 text-gray-500">{formatDate(invoice.dueDate)}</td>
                    <td className="px-5 py-4 text-right font-semibold text-gray-900">
                      {formatCurrency(Number(invoice.totalAmount), "INR")}
                    </td>
                    <td className="px-5 py-4">
                      <InvoiceStatusBadge status={invoice.status} />
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

      <CreateInvoiceModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={() => router.refresh()}
      />
    </>
  );
}
