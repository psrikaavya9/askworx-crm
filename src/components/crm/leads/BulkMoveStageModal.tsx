"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ArrowRightCircle } from "lucide-react";

const STAGE_OPTIONS = [
  { value: "NEW",       label: "New"       },
  { value: "CONTACTED", label: "Contacted" },
  { value: "QUALIFIED", label: "Qualified" },
  { value: "PROPOSAL",  label: "Proposal"  },
  { value: "WON",       label: "Won"       },
  { value: "LOST",      label: "Lost"      },
];

interface BulkMoveStageModalProps {
  open:      boolean;
  leadCount: number;
  leadIds:   string[];
  onClose:   () => void;
  onSuccess: (updated: number) => void;
}

export function BulkMoveStageModal({
  open,
  leadCount,
  leadIds,
  onClose,
  onSuccess,
}: BulkMoveStageModalProps) {
  const [stage,   setStage]   = useState("CONTACTED");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/crm/leads/bulk-stage", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ lead_ids: leadIds, stage }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Stage update failed");
      onSuccess(json.updated);
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
      title="Move Stage"
      description={`Move ${leadCount} selected lead${leadCount !== 1 ? "s" : ""} to a new stage`}
      size="sm"
    >
      <div className="flex flex-col gap-4">
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Target Stage</label>
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          >
            {STAGE_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            icon={<ArrowRightCircle className="h-4 w-4" />}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? "Moving…" : "Move"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
