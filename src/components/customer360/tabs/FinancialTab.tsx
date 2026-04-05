import Link from "next/link";
import { ReceiptText, TrendingUp, AlertCircle, ArrowRight } from "lucide-react";
import { InvoiceStatusBadge } from "@/components/finance/shared/InvoiceStatusBadge";
import { formatDate, formatCurrency } from "@/lib/utils";
import type { C360Invoice } from "../types";
import type { InvoiceStatus } from "@/modules/finance/types";

interface Props {
  invoices: C360Invoice[];
}

export function FinancialTab({ invoices }: Props) {
  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
          <ReceiptText className="h-7 w-7 text-gray-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-700">No invoices yet</p>
          <p className="mt-1 text-xs text-gray-400">
            Invoices raised for this client will appear here.
          </p>
        </div>
      </div>
    );
  }

  const totalInvoiced = invoices.reduce((s, i) => s + Number(i.totalAmount), 0);
  const totalPaid = invoices.reduce(
    (s, i) => s + i.payments.reduce((ps, p) => ps + Number(p.amount), 0),
    0,
  );
  const outstanding = totalInvoiced - totalPaid;
  const overdueCount = invoices.filter((i) => i.status === "OVERDUE").length;

  return (
    <div className="space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Total Invoiced
          </p>
          <p className="mt-1 text-xl font-bold text-gray-900">
            {formatCurrency(totalInvoiced, "INR")}
          </p>
          <p className="text-xs text-gray-400">{invoices.length} invoices</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Total Collected
          </p>
          <p className="mt-1 text-xl font-bold text-emerald-600">
            {formatCurrency(totalPaid, "INR")}
          </p>
          <p className="text-xs text-emerald-500">
            {totalInvoiced > 0
              ? `${Math.round((totalPaid / totalInvoiced) * 100)}% collected`
              : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Outstanding
          </p>
          <p
            className={`mt-1 text-xl font-bold ${
              outstanding > 0 ? "text-amber-600" : "text-gray-900"
            }`}
          >
            {formatCurrency(outstanding, "INR")}
          </p>
          <p className="text-xs text-gray-400">balance due</p>
        </div>
        <div
          className={`rounded-xl border px-4 py-3 ${
            overdueCount > 0
              ? "border-red-200 bg-red-50"
              : "border-gray-200 bg-white"
          }`}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Overdue
          </p>
          <p
            className={`mt-1 text-xl font-bold ${
              overdueCount > 0 ? "text-red-600" : "text-gray-900"
            }`}
          >
            {overdueCount}
          </p>
          <p className="text-xs text-gray-400">invoice{overdueCount !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Overdue warning */}
      {overdueCount > 0 && (
        <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
          <p className="text-sm text-red-700">
            <span className="font-semibold">{overdueCount} invoice{overdueCount > 1 ? "s" : ""}</span>{" "}
            {overdueCount > 1 ? "are" : "is"} overdue. Follow up with the client.
          </p>
        </div>
      )}

      {/* Invoice list */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Invoice
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Status
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Issue Date
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Due Date
              </th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Amount
              </th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Collected
              </th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {invoices.map((invoice) => {
              const paid = invoice.payments.reduce(
                (s, p) => s + Number(p.amount),
                0,
              );
              const pct =
                invoice.totalAmount > 0
                  ? Math.min(100, Math.round((paid / invoice.totalAmount) * 100))
                  : 0;

              return (
                <tr
                  key={invoice.id}
                  className={`transition-colors hover:bg-gray-50 ${
                    invoice.status === "OVERDUE" ? "bg-red-50/30" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/finance/invoices/${invoice.id}`}
                      className="font-mono text-xs font-medium text-indigo-600 hover:text-indigo-800"
                    >
                      {invoice.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <InvoiceStatusBadge status={invoice.status as InvoiceStatus} />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {formatDate(invoice.issueDate)}
                  </td>
                  <td
                    className={`px-4 py-3 text-xs ${
                      invoice.status === "OVERDUE"
                        ? "font-semibold text-red-600"
                        : "text-gray-500"
                    }`}
                  >
                    {formatDate(invoice.dueDate)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                    {formatCurrency(invoice.totalAmount, "INR")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={`h-full rounded-full ${
                            pct >= 100 ? "bg-emerald-500" : pct > 0 ? "bg-amber-400" : "bg-gray-200"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{pct}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/finance/invoices/${invoice.id}`}
                      className="flex items-center text-gray-300 hover:text-gray-600 transition-colors"
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
