"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Select } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  company: string;
}

const STATUS_OPTIONS = [
  { value: "PLANNING", label: "Planning" },
  { value: "ACTIVE", label: "Active" },
  { value: "ON_HOLD", label: "On Hold" },
  { value: "COMPLETED", label: "Completed" },
];

export default function NewProjectPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState({
    name: "",
    description: "",
    startDate: "",
    deadline: "",
    status: "PLANNING",
    clientId: "",
    invoiceIds: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/crm/clients?pageSize=100")
      .then((r) => r.json())
      .then((data) => {
        if (data.data) setClients(data.data);
      })
      .catch(() => {});
  }, []);

  function handleChange(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        status: form.status,
        invoiceIds: form.invoiceIds
          ? form.invoiceIds.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
      };

      if (form.description) payload.description = form.description;
      if (form.startDate)
        payload.startDate = new Date(form.startDate).toISOString();
      if (form.deadline)
        payload.deadline = new Date(form.deadline).toISOString();
      if (form.clientId) payload.clientId = form.clientId;

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.error && typeof data.error === "object") {
          const fieldMsgs = Object.entries(data.error.fieldErrors ?? {})
            .map(([f, msgs]) => `${f}: ${(msgs as string[]).join(", ")}`)
            .join("; ");
          const formMsgs = (data.error.formErrors ?? []).join("; ");
          throw new Error(fieldMsgs || formMsgs || "Validation failed");
        }
        throw new Error(data.error ?? "Failed to create project");
      }

      const project = await res.json();
      router.push(`/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const clientOptions = [
    { value: "", label: "No client" },
    ...clients.map((c) => ({
      value: c.id,
      label: `${c.firstName} ${c.lastName} · ${c.company}`,
    })),
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <Link href="/projects" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          All Projects
        </Link>
        <div className="mt-4">
          <h1 className="text-2xl font-semibold text-gray-900">New Project</h1>
          <p className="mt-1 text-sm text-gray-500">Fill in the details below to create a new project.</p>
        </div>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="Project Name"
            required
            value={form.name}
            onChange={(e) => handleChange("name", e.target.value)}
            placeholder="e.g. Website Redesign"
          />

          <Textarea
            label="Description"
            value={form.description}
            onChange={(e) => handleChange("description", e.target.value)}
            placeholder="What is this project about?"
            rows={3}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              value={form.startDate}
              onChange={(e) => handleChange("startDate", e.target.value)}
            />
            <Input
              label="Deadline"
              type="date"
              value={form.deadline}
              onChange={(e) => handleChange("deadline", e.target.value)}
            />
          </div>

          <Select
            label="Status"
            options={STATUS_OPTIONS}
            value={form.status}
            onChange={(e) => handleChange("status", e.target.value)}
          />

          <Select
            label="Client"
            options={clientOptions}
            value={form.clientId}
            onChange={(e) => handleChange("clientId", e.target.value)}
            placeholder="Select a client (optional)"
          />

          <Input
            label="Invoice IDs"
            value={form.invoiceIds}
            onChange={(e) => handleChange("invoiceIds", e.target.value)}
            placeholder="INV-001, INV-002 (future Finance module)"
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <Link href="/projects">
              <Button variant="secondary" type="button">
                Cancel
              </Button>
            </Link>
            <Button type="submit" loading={loading}>
              Create Project
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
