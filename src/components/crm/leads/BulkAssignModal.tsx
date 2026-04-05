"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { UserCheck, RefreshCw } from "lucide-react";

interface StaffOption {
  id:        string;
  firstName: string;
  lastName:  string;
}

interface BulkAssignModalProps {
  open:        boolean;
  leadCount:   number;
  leadIds:     string[];
  onClose:     () => void;
  onSuccess:   (updated: number, skipped: number) => void;
}

export function BulkAssignModal({
  open,
  leadCount,
  leadIds,
  onClose,
  onSuccess,
}: BulkAssignModalProps) {
  const [staff,      setStaff]      = useState<StaffOption[]>([]);
  const [assignedTo, setAssignedTo] = useState("");
  const [overwrite,  setOverwrite]  = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [fetching,   setFetching]   = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // Fetch active staff whenever the modal opens
  useEffect(() => {
    if (!open) return;
    setFetching(true);
    setError(null);
    fetch("/api/staff?status=ACTIVE&pageSize=100")
      .then((r) => r.json())
      .then((json) => {
        const list: StaffOption[] = (json.data ?? []).map((s: StaffOption) => s);
        setStaff(list);
        setAssignedTo(list[0]?.id ?? "");
      })
      .catch(() => setError("Failed to load staff. Please try again."))
      .finally(() => setFetching(false));
  }, [open]);

  async function handleConfirm() {
    if (!assignedTo) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/crm/leads/bulk-assign", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ lead_ids: leadIds, assigned_to: assignedTo, overwrite }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Assignment failed");
      onSuccess(json.updated, json.skipped);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Assign Leads"
      description={`Assign ${leadCount} selected lead${leadCount !== 1 ? "s" : ""} to a sales rep`}
      size="sm"
    >
      <div className="flex flex-col gap-4">
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Sales Rep</label>
          {fetching ? (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Loading staff…
            </div>
          ) : (
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            >
              {staff.length === 0 && (
                <option value="">No active staff found</option>
              )}
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.firstName} {s.lastName}
                </option>
              ))}
            </select>
          )}
        </div>

        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={overwrite}
            onChange={(e) => setOverwrite(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="text-sm text-gray-700">
            Re-assign already assigned leads
          </span>
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            icon={<UserCheck className="h-4 w-4" />}
            onClick={handleConfirm}
            disabled={!assignedTo || loading || fetching}
          >
            {loading ? "Assigning…" : "Assign"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
