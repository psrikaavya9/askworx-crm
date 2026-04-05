"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";

const STAGE_OPTIONS = [
  { value: "NEW", label: "New" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "QUALIFIED", label: "Qualified" },
  { value: "PROPOSAL", label: "Proposal" },
];

const SOURCE_OPTIONS = [
  { value: "WEBSITE", label: "Website" },
  { value: "REFERRAL", label: "Referral" },
  { value: "SOCIAL_MEDIA", label: "Social Media" },
  { value: "EMAIL_CAMPAIGN", label: "Email Campaign" },
  { value: "COLD_CALL", label: "Cold Call" },
  { value: "TRADE_SHOW", label: "Trade Show" },
  { value: "PARTNER", label: "Partner" },
  { value: "OTHER", label: "Other" },
];

const PRIORITY_OPTIONS = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
];

interface LeadActionsProps {
  lead: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
    company?: string | null;
    jobTitle?: string | null;
    source: string;
    stage: string;
    priority: string;
    dealValue?: number | string | null | { toString(): string };
  };
}

export function LeadActions({ lead }: LeadActionsProps) {
  const router = useRouter();
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    firstName: lead.firstName,
    lastName: lead.lastName,
    email: lead.email,
    phone: lead.phone ?? "",
    company: lead.company ?? "",
    jobTitle: lead.jobTitle ?? "",
    source: lead.source,
    stage: lead.stage,
    priority: lead.priority,
    dealValue: lead.dealValue != null ? String(lead.dealValue) : "",
  });

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/crm/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          phone: form.phone || undefined,
          company: form.company || undefined,
          jobTitle: form.jobTitle || undefined,
          dealValue: form.dealValue ? Number(form.dealValue) : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to update lead");
      }
      setShowEdit(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/leads/${lead.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete lead");
      router.push("/crm/leads");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        icon={<Pencil className="h-3.5 w-3.5" />}
        onClick={() => setShowEdit(true)}
      >
        Edit
      </Button>
      <Button
        variant="danger"
        size="sm"
        icon={<Trash2 className="h-3.5 w-3.5" />}
        onClick={() => setShowDelete(true)}
      >
        Delete
      </Button>

      {/* Edit Modal */}
      <Modal open={showEdit} onClose={() => { setShowEdit(false); setError(""); }} title="Edit Lead" size="lg">
        <form onSubmit={handleUpdate} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Input label="First Name" required value={form.firstName}
              onChange={(e) => set("firstName", e.target.value)} />
            <Input label="Last Name" required value={form.lastName}
              onChange={(e) => set("lastName", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Email" type="email" required value={form.email}
              onChange={(e) => set("email", e.target.value)} />
            <Input label="Phone" value={form.phone}
              onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Company" value={form.company}
              onChange={(e) => set("company", e.target.value)} />
            <Input label="Job Title" value={form.jobTitle}
              onChange={(e) => set("jobTitle", e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Select label="Source" value={form.source} options={SOURCE_OPTIONS}
              onChange={(e) => set("source", e.target.value)} />
            <Select label="Stage" value={form.stage} options={STAGE_OPTIONS}
              onChange={(e) => set("stage", e.target.value)} />
            <Select label="Priority" value={form.priority} options={PRIORITY_OPTIONS}
              onChange={(e) => set("priority", e.target.value)} />
          </div>
          <Input label="Deal Value" type="number" min="0" value={form.dealValue}
            onChange={(e) => set("dealValue", e.target.value)} placeholder="5000" />
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <Button type="button" variant="secondary" onClick={() => { setShowEdit(false); setError(""); }}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>Save Changes</Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={showDelete} onClose={() => { setShowDelete(false); setError(""); }} title="Delete Lead" size="sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg bg-red-50 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
            <div>
              <p className="text-sm font-medium text-red-800">This action cannot be undone.</p>
              <p className="mt-1 text-sm text-red-600">
                All notes, activities, and reminders linked to{" "}
                <strong>{lead.firstName} {lead.lastName}</strong> will be permanently deleted.
              </p>
            </div>
          </div>
          {error && (
            <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => { setShowDelete(false); setError(""); }}>
              Cancel
            </Button>
            <Button variant="danger" loading={loading} onClick={handleDelete}>
              Delete Lead
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
