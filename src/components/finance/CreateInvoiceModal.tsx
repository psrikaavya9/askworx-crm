"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Input";

interface LineItem {
  description: string;
  quantity: string;
  unitPrice: string;
}

interface ClientOption {
  id: string;
  firstName: string;
  lastName: string;
  company: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateInvoiceModal({ open, onClose, onCreated }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [items, setItems] = useState<LineItem[]>([{ description: "", quantity: "1", unitPrice: "" }]);
  const [form, setForm] = useState({
    invoiceNumber: "",
    clientId: "",
    issueDate: "",
    dueDate: "",
    cgst: "",
    sgst: "",
    igst: "",
    notes: "",
  });

  // Fetch clients when the modal opens
  useEffect(() => {
    if (!open) return;
    fetch("/api/crm/clients?pageSize=100")
      .then((r) => r.json())
      .then((data) => setClients(data.data ?? []))
      .catch(() => setClients([]));
  }, [open]);

  function updateItem(index: number, field: keyof LineItem, value: string) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  function addItem() {
    setItems((prev) => [...prev, { description: "", quantity: "1", unitPrice: "" }]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const subtotal = items.reduce((sum, item) => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unitPrice) || 0;
    return sum + qty * price;
  }, 0);

  const cgst = parseFloat(form.cgst) || 0;
  const sgst = parseFloat(form.sgst) || 0;
  const igst = parseFloat(form.igst) || 0;
  const totalTax = cgst + sgst + igst;
  const totalAmount = subtotal + totalTax;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          cgst: cgst || undefined,
          sgst: sgst || undefined,
          igst: igst || undefined,
          items: items.map((item) => ({
            description: item.description,
            quantity: parseFloat(item.quantity),
            unitPrice: parseFloat(item.unitPrice),
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to create invoice");
        return;
      }

      onCreated();
      onClose();
      setForm({ invoiceNumber: "", clientId: "", issueDate: "", dueDate: "", cgst: "", sgst: "", igst: "", notes: "" });
      setItems([{ description: "", quantity: "1", unitPrice: "" }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New Invoice" size="lg">
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        {/* Client selector */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Client <span className="text-red-500">*</span>
          </label>
          <select
            value={form.clientId}
            onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
            required
            className={`w-full rounded-lg border bg-white py-2.5 pl-3 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-colors ${
              !form.clientId ? "border-red-300 focus:border-red-400" : "border-gray-300 focus:border-indigo-500"
            }`}
          >
            <option value="">— Select a client —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName} · {c.company}
              </option>
            ))}
          </select>
          {!form.clientId && (
            <p className="mt-1 text-xs text-red-500">Client is required</p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Input
            label="Invoice Number *"
            placeholder="INV-2026-001"
            value={form.invoiceNumber}
            onChange={(e) => setForm((f) => ({ ...f, invoiceNumber: e.target.value }))}
            required
          />
          <Input
            label="Issue Date *"
            type="date"
            value={form.issueDate}
            onChange={(e) => setForm((f) => ({ ...f, issueDate: e.target.value }))}
            required
          />
          <Input
            label="Due Date *"
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
            required
          />
        </div>

        {/* Line Items */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">Line Items</label>
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="flex gap-2">
                <input
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => updateItem(i, "description", e.target.value)}
                  required
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <input
                  type="number"
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(e) => updateItem(i, "quantity", e.target.value)}
                  required
                  min="0.001"
                  step="0.001"
                  className="w-20 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
                <input
                  type="number"
                  placeholder="Unit Price"
                  value={item.unitPrice}
                  onChange={(e) => updateItem(i, "unitPrice", e.target.value)}
                  required
                  min="0"
                  step="0.01"
                  className="w-28 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
                <span className="flex w-24 items-center justify-end text-sm font-medium text-gray-700">
                  ₹{((parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0)).toLocaleString("en-IN")}
                </span>
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addItem}
            className="mt-2 flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800"
          >
            <Plus className="h-3.5 w-3.5" /> Add line item
          </button>
        </div>

        {/* GST */}
        <div className="grid grid-cols-3 gap-3">
          <Input
            label="CGST (₹)"
            type="number"
            min="0"
            step="0.01"
            placeholder="0"
            value={form.cgst}
            onChange={(e) => setForm((f) => ({ ...f, cgst: e.target.value }))}
          />
          <Input
            label="SGST (₹)"
            type="number"
            min="0"
            step="0.01"
            placeholder="0"
            value={form.sgst}
            onChange={(e) => setForm((f) => ({ ...f, sgst: e.target.value }))}
          />
          <Input
            label="IGST (₹)"
            type="number"
            min="0"
            step="0.01"
            placeholder="0"
            value={form.igst}
            onChange={(e) => setForm((f) => ({ ...f, igst: e.target.value }))}
          />
        </div>

        {/* Totals */}
        <div className="rounded-lg bg-gray-50 p-4 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span>
            <span>₹{subtotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
          </div>
          {totalTax > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>Total Tax</span>
              <span>₹{totalTax.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
            </div>
          )}
          <div className="mt-2 flex justify-between border-t border-gray-200 pt-2 font-semibold text-gray-900">
            <span>Total</span>
            <span>₹{totalAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        <Textarea
          label="Notes"
          placeholder="Payment terms, bank details, etc."
          value={form.notes}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm((f) => ({ ...f, notes: e.target.value }))}
          rows={2}
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading} disabled={!form.clientId}>
            Create Invoice
          </Button>
        </div>
      </form>
    </Modal>
  );
}
