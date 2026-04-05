"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, CheckCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { InvoiceStatusBadge } from "@/components/finance/shared/InvoiceStatusBadge";
import { RecordPaymentModal } from "@/components/finance/RecordPaymentModal";
import { formatDate, formatCurrency } from "@/lib/utils";
import { PAYMENT_METHOD_LABELS } from "@/modules/finance/types";
import type { InvoiceWithItems, Payment } from "@/modules/finance/types";

interface Props {
  invoice: InvoiceWithItems;
}

export function InvoiceDetailClient({ invoice }: Props) {
  const router = useRouter();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const totalPaid = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const balance = Number(invoice.totalAmount) - totalPaid;

  async function handleMarkSent() {
    setActionLoading(true);
    try {
      await fetch(`/api/invoices/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "SENT" }),
      });
      router.refresh();
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">{invoice.invoiceNumber}</h2>
            <p className="mt-1 text-sm text-gray-500">
              {invoice.client
                ? `${invoice.client.firstName} ${invoice.client.lastName} · ${invoice.client.company}`
                : "No client assigned"}
              {invoice.project && ` · ${invoice.project.name}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <InvoiceStatusBadge status={invoice.status} />
            {invoice.status === "DRAFT" && (
              <Button
                variant="secondary"
                icon={<Send className="h-4 w-4" />}
                onClick={handleMarkSent}
                loading={actionLoading}
              >
                Mark Sent
              </Button>
            )}
            {invoice.status !== "PAID" && (
              <Button
                icon={<CreditCard className="h-4 w-4" />}
                onClick={() => setShowPaymentModal(true)}
              >
                Record Payment
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-gray-500">Issue Date</p>
            <p className="mt-1 font-medium text-gray-900">{formatDate(invoice.issueDate)}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-gray-500">Due Date</p>
            <p className="mt-1 font-medium text-gray-900">{formatDate(invoice.dueDate)}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-gray-500">Balance Due</p>
            <p className={`mt-1 font-bold ${balance > 0 ? "text-red-600" : "text-green-600"}`}>
              {formatCurrency(balance, "INR")}
            </p>
          </div>
        </div>

        {/* Line Items */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 bg-gray-50 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-700">Line Items</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-4 py-3 text-left font-medium text-gray-600">Description</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Qty</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Unit Price</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {invoice.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 text-gray-700">{item.description}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{Number(item.quantity)}</td>
                  <td className="px-4 py-3 text-right text-gray-500">
                    {formatCurrency(Number(item.unitPrice), "INR")}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {formatCurrency(Number(item.total), "INR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 text-sm">
            <div className="ml-auto max-w-xs space-y-1">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>{formatCurrency(Number(invoice.subtotal), "INR")}</span>
              </div>
              {Number(invoice.cgst) > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>CGST</span>
                  <span>{formatCurrency(Number(invoice.cgst), "INR")}</span>
                </div>
              )}
              {Number(invoice.sgst) > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>SGST</span>
                  <span>{formatCurrency(Number(invoice.sgst), "INR")}</span>
                </div>
              )}
              {Number(invoice.igst) > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>IGST</span>
                  <span>{formatCurrency(Number(invoice.igst), "INR")}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-gray-200 pt-2 font-bold text-gray-900">
                <span>Total</span>
                <span>{formatCurrency(Number(invoice.totalAmount), "INR")}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payments */}
        {invoice.payments.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-100 bg-gray-50 px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-700">Payment History</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Method</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Reference</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {invoice.payments.map((payment: Payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700">{formatDate(payment.paymentDate)}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {PAYMENT_METHOD_LABELS[payment.paymentMethod]}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{payment.referenceNumber ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-medium text-green-700">
                      {formatCurrency(Number(payment.amount), "INR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end border-t border-gray-100 bg-gray-50 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-green-700">
                <CheckCircle className="h-4 w-4" />
                Total Paid: {formatCurrency(totalPaid, "INR")}
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        {invoice.notes && (
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="mb-1 text-sm font-semibold text-gray-700">Notes</h3>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        )}
      </div>

      <RecordPaymentModal
        open={showPaymentModal}
        invoiceId={invoice.id}
        onClose={() => setShowPaymentModal(false)}
        onRecorded={() => {
          setShowPaymentModal(false);
          router.refresh();
        }}
      />
    </>
  );
}
