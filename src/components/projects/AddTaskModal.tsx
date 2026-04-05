"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Select } from "@/components/ui/Input";

interface AddTaskModalProps {
  open: boolean;
  projectId: string;
  onClose: () => void;
  onCreated: (task: TaskRow) => void;
}

export interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  projectId: string;
  assignedStaff: string[];
  status: "TODO" | "IN_PROGRESS" | "DONE";
  priority: "LOW" | "MEDIUM" | "HIGH";
  dueDate: string | null;
  hoursLogged: string | number;
  createdAt: string;
  updatedAt: string;
}

const PRIORITY_OPTIONS = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
];

const STATUS_OPTIONS = [
  { value: "TODO", label: "To Do" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "DONE", label: "Done" },
];

export function AddTaskModal({
  open,
  projectId,
  onClose,
  onCreated,
}: AddTaskModalProps) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    assignedStaff: "",
    priority: "MEDIUM",
    status: "TODO",
    dueDate: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChange(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        title: form.title,
        priority: form.priority,
        status: form.status,
        assignedStaff: form.assignedStaff
          ? form.assignedStaff.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
      };
      if (form.description) payload.description = form.description;
      if (form.dueDate) payload.dueDate = new Date(form.dueDate).toISOString();

      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to create task");
      }

      const task = await res.json();
      onCreated(task);
      setForm({
        title: "",
        description: "",
        assignedStaff: "",
        priority: "MEDIUM",
        status: "TODO",
        dueDate: "",
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Task" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Title"
          required
          value={form.title}
          onChange={(e) => handleChange("title", e.target.value)}
          placeholder="Task title"
        />
        <Textarea
          label="Description"
          value={form.description}
          onChange={(e) => handleChange("description", e.target.value)}
          placeholder="Optional description"
          rows={2}
        />
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Priority"
            options={PRIORITY_OPTIONS}
            value={form.priority}
            onChange={(e) => handleChange("priority", e.target.value)}
          />
          <Select
            label="Status"
            options={STATUS_OPTIONS}
            value={form.status}
            onChange={(e) => handleChange("status", e.target.value)}
          />
        </div>
        <Input
          label="Due Date"
          type="date"
          value={form.dueDate}
          onChange={(e) => handleChange("dueDate", e.target.value)}
        />
        <Input
          label="Assigned Staff"
          value={form.assignedStaff}
          onChange={(e) => handleChange("assignedStaff", e.target.value)}
          placeholder="Names or IDs, comma separated"
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Create Task
          </Button>
        </div>
      </form>
    </Modal>
  );
}
