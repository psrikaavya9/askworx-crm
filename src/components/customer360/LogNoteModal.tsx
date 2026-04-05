"use client";

import { useState } from "react";
import { StickyNote, CheckCircle2, AlertCircle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useApiClient } from "@/lib/api-client";
import { useRouter } from "next/navigation";

interface Props {
  clientId:  string;
  onSuccess?: () => void;
}

export function LogNoteModal({ clientId, onSuccess }: Props) {
  const router = useRouter();
  const api    = useApiClient();

  const [open,        setOpen]        = useState(false);
  const [content,     setContent]     = useState("");
  const [error,       setError]       = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting,  setSubmitting]  = useState(false);
  const [submitted,   setSubmitted]   = useState(false);

  function handleOpen() {
    setOpen(true);
    setContent("");
    setError("");
    setSubmitError("");
    setSubmitted(false);
  }

  function handleClose() {
    if (submitting) return;
    setOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) {
      setError("Note content is required.");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      await api.post("/api/interactions", {
        clientId,
        type:    "NOTE",
        date:    new Date().toISOString(),
        notes:   content.trim(),
        outcome: "Note",
      });
      setSubmitted(true);
      onSuccess?.();
      router.refresh();
      setTimeout(handleClose, 1_800);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to save note");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button variant="secondary" icon={<StickyNote className="h-4 w-4" />} onClick={handleOpen}>
        Add Note
      </Button>

      <Modal open={open} onClose={handleClose} title="Add Note" description="Log a note about this client" size="sm">
        {submitted ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
              <CheckCircle2 className="h-7 w-7 text-amber-600" />
            </span>
            <div>
              <p className="text-sm font-semibold text-gray-900">Note Saved</p>
              <p className="mt-1 text-xs text-gray-500">Your note is pending review and will appear in the timeline.</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {submitError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                <p className="text-sm text-red-700">{submitError}</p>
              </div>
            )}
            <Textarea
              label="Note"
              required
              placeholder="Write your note here…"
              rows={4}
              value={content}
              onChange={(e) => { setContent(e.target.value); setError(""); }}
              error={error}
            />
            <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
              <Button type="button" variant="secondary" onClick={handleClose} disabled={submitting}>Cancel</Button>
              <Button type="submit" loading={submitting} icon={<StickyNote className="h-4 w-4" />}>Save Note</Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
