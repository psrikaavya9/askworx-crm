"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Input";

interface Props {
  open: boolean;
  invoiceId: string;
  onClose: () => void;
  onRecorded: () => void;
}

export function RecordPaymentModal({ open, invoiceId, onClose, onRecorded }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    amount: "",
    paymentDate: new Date().toISOString().split("T")[0],
    paymentMethod: "BANK",
    referenceNumber: "",
    notes: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId,
          amount: parseFloat(form.amount),
          paymentDate: form.paymentDate,
          paymentMethod: form.paymentMethod,
          referenceNumber: form.referenceNumber || undefined,
          notes: form.notes || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to record payment");
        return;
      }

      onRecorded();
      onClose();
      setForm({ amount: "", paymentDate: new Date().toISOString().split("T")[0], paymentMethod: "BANK", referenceNumber: "", notes: "" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Record Payment">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Amount (₹) *"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            required
          />
          <Input
            label="Payment Date *"
            type="date"
            value={form.paymentDate}
            onChange={(e) => setForm((f) => ({ ...f, paymentDate: e.target.value }))}
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Payment Method *</label>
          <select
            value={form.paymentMethod}
            onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))}
            className="w-full rounded-md border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm focus:border-indigo-500 focus:outline-none"
            required
          >
            <option value="CASH">Cash</option>
            <option value="BANK">Bank Transfer</option>
            <option value="UPI">UPI</option>
            <option value="CARD">Card</option>
          </select>
        </div>

        <Input
          label="Reference Number"
          placeholder="Transaction ID / Cheque No."
          value={form.referenceNumber}
          onChange={(e) => setForm((f) => ({ ...f, referenceNumber: e.target.value }))}
        />

        <Textarea
          label="Notes"
          placeholder="Optional payment notes"
          value={form.notes}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm((f) => ({ ...f, notes: e.target.value }))}
          rows={2}
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Record Payment
          </Button>
        </div>
      </form>
    </Modal>
  );
}
