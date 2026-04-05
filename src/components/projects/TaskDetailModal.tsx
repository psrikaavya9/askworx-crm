"use client";

import { useState, useEffect, useCallback } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Select } from "@/components/ui/Input";
import { formatDate } from "@/lib/utils";
import { Clock, Plus } from "lucide-react";

interface TimeLog {
  id: string;
  taskId: string;
  hours: string | number;
  note: string | null;
  loggedAt: string;
}

export interface TaskFull {
  id: string;
  title: string;
  description: string | null;
  projectId: string;
  assignedStaff: string[];
  status: "TODO" | "IN_PROGRESS" | "DONE";
  priority: "LOW" | "MEDIUM" | "HIGH";
  dueDate: string | null;
  hoursLogged: string | number;
  timeLogs?: TimeLog[];
  createdAt: string;
  updatedAt: string;
}

interface TaskDetailModalProps {
  task: TaskFull | null;
  onClose: () => void;
  onUpdated: (task: TaskFull) => void;
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

export function TaskDetailModal({
  task,
  onClose,
  onUpdated,
}: TaskDetailModalProps) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    assignedStaff: "",
    priority: "MEDIUM",
    status: "TODO",
    dueDate: "",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [logHours, setLogHours] = useState("");
  const [logNote, setLogNote] = useState("");
  const [logging, setLogging] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);

  const loadTimeLogs = useCallback(async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/timelogs`);
      if (res.ok) {
        const data = await res.json();
        setTimeLogs(data);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (task) {
      setForm({
        title: task.title,
        description: task.description ?? "",
        assignedStaff: task.assignedStaff.join(", "),
        priority: task.priority,
        status: task.status,
        dueDate: task.dueDate
          ? new Date(task.dueDate).toISOString().split("T")[0]
          : "",
      });
      setSaveError(null);
      setLogError(null);
      loadTimeLogs(task.id);
    }
  }, [task, loadTimeLogs]);

  function handleChange(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!task) return;
    setSaveError(null);
    setSaving(true);
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
      else payload.dueDate = null;

      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save");
      }

      const updated = await res.json();
      onUpdated(updated);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogTime(e: React.FormEvent) {
    e.preventDefault();
    if (!task || !logHours) return;
    setLogError(null);
    setLogging(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/timelogs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hours: parseFloat(logHours),
          note: logNote || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to log time");
      }

      setLogHours("");
      setLogNote("");
      await loadTimeLogs(task.id);
    } catch (err) {
      setLogError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLogging(false);
    }
  }

  const totalLogged = timeLogs.reduce((sum, l) => sum + Number(l.hours), 0);

  return (
    <Modal
      open={!!task}
      onClose={onClose}
      title="Task Details"
      size="lg"
    >
      {task && (
        <div className="space-y-6">
          {/* Edit form */}
          <form onSubmit={handleSave} className="space-y-4">
            <Input
              label="Title"
              required
              value={form.title}
              onChange={(e) => handleChange("title", e.target.value)}
            />
            <Textarea
              label="Description"
              value={form.description}
              onChange={(e) => handleChange("description", e.target.value)}
              rows={3}
            />
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Status"
                options={STATUS_OPTIONS}
                value={form.status}
                onChange={(e) => handleChange("status", e.target.value)}
              />
              <Select
                label="Priority"
                options={PRIORITY_OPTIONS}
                value={form.priority}
                onChange={(e) => handleChange("priority", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
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
                placeholder="Names, comma separated"
              />
            </div>
            {saveError && <p className="text-sm text-red-600">{saveError}</p>}
            <div className="flex justify-end">
              <Button type="submit" loading={saving} size="sm">
                Save Changes
              </Button>
            </div>
          </form>

          <hr className="border-gray-100" />

          {/* Time Tracking */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Clock className="h-4 w-4 text-indigo-500" />
                Time Tracking
              </h3>
              <span className="text-sm font-medium text-gray-700">
                Total: {totalLogged.toFixed(1)}h
              </span>
            </div>

            {/* Log time form */}
            <form onSubmit={handleLogTime} className="mb-4 flex items-end gap-3">
              <div className="w-24">
                <Input
                  label="Hours"
                  type="number"
                  min="0.1"
                  max="24"
                  step="0.1"
                  required
                  value={logHours}
                  onChange={(e) => setLogHours(e.target.value)}
                  placeholder="0.0"
                />
              </div>
              <div className="flex-1">
                <Input
                  label="Note"
                  value={logNote}
                  onChange={(e) => setLogNote(e.target.value)}
                  placeholder="What did you work on?"
                />
              </div>
              <Button
                type="submit"
                size="sm"
                loading={logging}
                icon={<Plus className="h-3.5 w-3.5" />}
              >
                Log Time
              </Button>
            </form>

            {logError && <p className="mb-2 text-sm text-red-600">{logError}</p>}

            {/* Time logs table */}
            {timeLogs.length === 0 ? (
              <p className="text-sm text-gray-400">No time logs yet.</p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-gray-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-3 py-2 text-left font-medium text-gray-600">
                        Date
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">
                        Hours
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">
                        Note
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {timeLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="px-3 py-2 text-gray-500">
                          {formatDate(log.loggedAt)}
                        </td>
                        <td className="px-3 py-2 font-medium text-gray-900">
                          {Number(log.hours).toFixed(1)}h
                        </td>
                        <td className="px-3 py-2 text-gray-500">
                          {log.note ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
