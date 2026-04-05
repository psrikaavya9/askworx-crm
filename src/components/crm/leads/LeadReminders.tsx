"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCircle, Clock, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { cn, formatDateTime } from "@/lib/utils";
import type { FollowUpReminder } from "@/modules/crm/types";

interface LeadRemindersProps {
  leadId: string;
  reminders: FollowUpReminder[];
}

const statusColor: Record<string, string> = {
  PENDING: "text-yellow-600 bg-yellow-50",
  OVERDUE: "text-red-600 bg-red-50",
  COMPLETED: "text-green-600 bg-green-50",
  DISMISSED: "text-gray-400 bg-gray-50",
};

export function LeadReminders({ leadId, reminders }: LeadRemindersProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", dueAt: "" });
  const [loading, setLoading] = useState(false);

  async function createReminder(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch(`/api/crm/leads/${leadId}/reminders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          dueAt: new Date(form.dueAt).toISOString(),
          assignedTo: "admin",
          createdBy: "admin",
        }),
      });
      setShowModal(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function complete(reminderId: string) {
    await fetch(`/api/crm/reminders/${reminderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED" }),
    });
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700">Reminders</p>
        <Button size="sm" variant="ghost" icon={<Plus className="h-3.5 w-3.5" />}
          onClick={() => setShowModal(true)}>
          Add
        </Button>
      </div>

      {reminders.length === 0 ? (
        <div className="flex flex-col items-center py-6 text-center text-gray-400">
          <Bell className="mb-2 h-7 w-7" />
          <p className="text-sm">No reminders set</p>
        </div>
      ) : (
        <div className="space-y-2">
          {reminders.map((r) => (
            <div key={r.id} className="flex items-start gap-3 rounded-lg border border-gray-100 p-3">
              <div className={cn("mt-0.5 rounded-full p-1.5", statusColor[r.status] ?? "bg-gray-100 text-gray-500")}>
                <Clock className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">{r.title}</p>
                {r.description && <p className="text-xs text-gray-500">{r.description}</p>}
                <p className="mt-0.5 text-xs text-gray-400">{formatDateTime(r.dueAt)}</p>
              </div>
              {r.status === "PENDING" || r.status === "OVERDUE" ? (
                <button onClick={() => complete(r.id)}
                  className="shrink-0 text-gray-300 hover:text-green-500">
                  <CheckCircle className="h-5 w-5" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Reminder" size="sm">
        <form onSubmit={createReminder} className="space-y-3">
          <Input label="Title" required value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          <Textarea label="Description" value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          <Input label="Due Date & Time" type="datetime-local" required value={form.dueAt}
            onChange={(e) => setForm((f) => ({ ...f, dueAt: e.target.value }))} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" size="sm" loading={loading}>Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
