"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface RejectReasonModalProps {
  open: boolean;
  onClose: () => void;
  /** Called with the trimmed reason string — should throw on API error */
  onConfirm: (reason: string) => Promise<void>;
  expenseLabel?: string;
}

export function RejectReasonModal({
  open,
  onClose,
  onConfirm,
  expenseLabel,
}: RejectReasonModalProps) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed) { setError("Reason is required."); return; }

    setError(null);
    setLoading(true);
    try {
      await onConfirm(trimmed);
      setReason("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    if (loading) return;
    setReason("");
    setError(null);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Reject Expense"
      description={expenseLabel ? `Rejecting: ${expenseLabel}` : undefined}
      size="sm"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Rejection reason <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => { setReason(e.target.value); setError(null); }}
            placeholder="e.g. Receipt is unclear, duplicate entry, amount exceeds policy limit..."
            rows={4}
            disabled={loading}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60 transition-colors resize-none"
          />
          {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2.5 pt-1">
          <Button variant="secondary" type="button" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="danger" type="submit" loading={loading}>
            Reject Expense
          </Button>
        </div>
      </form>
    </Modal>
  );
}
