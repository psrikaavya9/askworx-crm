"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Input";
import { EXPENSE_CATEGORIES } from "@/modules/finance/types";
import { useApiClient } from "@/lib/api-client";

interface ClientOption {
  id: string;
  firstName: string;
  lastName: string;
  company: string;
}

interface ProjectOption {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const selectClass =
  "w-full rounded-md border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

export function AddExpenseModal({ open, onClose, onCreated }: Props) {
  const api = useApiClient();
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [clients, setClients]   = useState<ClientOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);

  const [form, setForm] = useState({
    category:   "",
    amount:     "",
    description:"",
    receiptUrl: "",
    date:       new Date().toISOString().split("T")[0],
    clientId:   "",
    projectId:  "",
  });

  // Fetch clients and projects when modal opens
  useEffect(() => {
    if (!open) return;

    api.get<{ data: ClientOption[] }>("/api/crm/clients?pageSize=100")
      .then((res) => setClients(res.data ?? []))
      .catch(() => setClients([]));

    api.get<{ data: ProjectOption[] }>("/api/projects?pageSize=100")
      .then((res) => setProjects(res.data ?? []))
      .catch(() => setProjects([]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function resetForm() {
    setForm({
      category: "", amount: "", description: "", receiptUrl: "",
      date: new Date().toISOString().split("T")[0],
      clientId: "", projectId: "",
    });
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await api.post("/api/expenses", {
        category:    form.category,
        amount:      parseFloat(form.amount),
        description: form.description  || undefined,
        receiptUrl:  form.receiptUrl   || undefined,
        date:        form.date,
        clientId:    form.clientId     || undefined,
        projectId:   form.projectId    || undefined,
      });

      onCreated();
      onClose();
      resetForm();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create expense");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Expense">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Category *</label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              required
              className={selectClass}
            >
              <option value="">Select category</option>
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
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
        </div>

        <Input
          label="Date *"
          type="date"
          value={form.date}
          onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          required
        />

        {/* Client (optional) */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Client <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <select
            value={form.clientId}
            onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
            className={selectClass}
          >
            <option value="">— No client —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName} · {c.company}
              </option>
            ))}
          </select>
        </div>

        {/* Project (optional) */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Project <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <select
            value={form.projectId}
            onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}
            className={selectClass}
          >
            <option value="">— No project —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <Textarea
          label="Description"
          placeholder="Brief description of the expense"
          value={form.description}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
            setForm((f) => ({ ...f, description: e.target.value }))
          }
          rows={2}
        />

        <Input
          label="Receipt URL"
          placeholder="https://..."
          value={form.receiptUrl}
          onChange={(e) => setForm((f) => ({ ...f, receiptUrl: e.target.value }))}
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Add Expense
          </Button>
        </div>
      </form>
    </Modal>
  );
}
