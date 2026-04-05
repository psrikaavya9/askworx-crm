"use client";

import { useState, useEffect, useRef } from "react";
import {
  Phone,
  CheckCircle2,
  AlertCircle,
  Bell,
  Clock,
  CalendarClock,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { useApiClient } from "@/lib/api-client";
import { useRouter } from "next/navigation";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OUTCOME_OPTIONS = [
  { value: "Interested",     label: "Interested" },
  { value: "Follow-up",      label: "Follow-up Required" },
  { value: "Not Interested", label: "Not Interested" },
  { value: "Deal Discussed", label: "Deal Discussed" },
  { value: "No Answer",      label: "No Answer" },
  { value: "Voicemail",      label: "Left Voicemail" },
];

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/** Format a Date to the value expected by <input type="datetime-local"> */
function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** Parse a datetime-local string to an ISO 8601 string suitable for the API */
function toIso(value: string): string {
  return new Date(value).toISOString();
}

/** Return the default follow-up date: tomorrow at 10:00 AM local time */
function defaultFollowUpDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return toDatetimeLocal(d);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FormState {
  callDate:    string; // datetime-local
  duration:    string; // minutes
  outcome:     string;
  notes:       string;
  nextFollowUp: string; // datetime-local — required when outcome = "Follow-up"
}

interface FormErrors {
  callDate?:    string;
  outcome?:     string;
  nextFollowUp?: string;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LogCallModalProps {
  clientId:  string;
  onSuccess?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LogCallModal({ clientId, onSuccess }: LogCallModalProps) {
  const router = useRouter();
  const api    = useApiClient();

  const followUpRef = useRef<HTMLDivElement>(null);

  // ── Modal state ───────────────────────────────────────────────────────────
  const [open, setOpen] = useState(false);

  // ── Form state ────────────────────────────────────────────────────────────
  const [form, setForm] = useState<FormState>(buildDefaultForm);
  const [errors, setErrors]           = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting]   = useState(false);

  // ── Success state ─────────────────────────────────────────────────────────
  const [submitted, setSubmitted] = useState(false);
  const [savedFollowUp, setSavedFollowUp] = useState<string | null>(null);

  function buildDefaultForm(): FormState {
    return {
      callDate:     toDatetimeLocal(new Date()),
      duration:     "",
      outcome:      "",
      notes:        "",
      nextFollowUp: defaultFollowUpDate(),
    };
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const isFollowUp = form.outcome === "Follow-up";

  // When outcome switches to Follow-up, scroll the follow-up field into view
  useEffect(() => {
    if (isFollowUp && open) {
      // Small delay so the field has time to animate in
      const timer = setTimeout(() => {
        followUpRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isFollowUp, open]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validate(): boolean {
    const next: FormErrors = {};

    if (!form.callDate) {
      next.callDate = "Call date is required";
    }

    if (!form.outcome) {
      next.outcome = "Outcome is required";
    }

    if (isFollowUp && !form.nextFollowUp) {
      next.nextFollowUp = "Follow-up date is required when outcome is Follow-up";
    }

    if (isFollowUp && form.nextFollowUp) {
      const fu = new Date(form.nextFollowUp);
      const cd = new Date(form.callDate);
      if (fu <= cd) {
        next.nextFollowUp = "Follow-up date must be after the call date";
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  // ── Open / close ──────────────────────────────────────────────────────────

  function handleOpen() {
    setOpen(true);
    setSubmitted(false);
    setSubmitError("");
    setErrors({});
    setSavedFollowUp(null);
    setForm(buildDefaultForm());
  }

  function handleClose() {
    if (submitting) return;
    setOpen(false);
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setSubmitError("");

    const followUpIso = isFollowUp && form.nextFollowUp
      ? toIso(form.nextFollowUp)
      : undefined;

    try {
      await api.post("/api/interactions", {
        clientId,
        type:         "CALL",
        date:         toIso(form.callDate),
        duration:     form.duration ? parseInt(form.duration, 10) : undefined,
        outcome:      form.outcome,
        notes:        form.notes.trim() || undefined,
        nextFollowUp: followUpIso,
      });

      // Store for success screen
      setSavedFollowUp(followUpIso ?? null);
      setSubmitted(true);
      onSuccess?.();
      router.refresh();

      setTimeout(handleClose, 2_200);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to log call");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Success screen ────────────────────────────────────────────────────────

  function SuccessScreen() {
    return (
      <div className="flex flex-col items-center gap-5 py-8 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </span>

        <div>
          <p className="text-base font-semibold text-gray-900">Call Logged</p>
          <p className="mt-1 text-sm text-gray-500">
            The call has been recorded and is pending review.
          </p>
        </div>

        {/* Follow-up reminder confirmation */}
        {savedFollowUp && (
          <div className="flex w-full items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-left">
            <Bell className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div>
              <p className="text-sm font-semibold text-amber-800">
                Follow-up reminder set
              </p>
              <p className="mt-0.5 text-sm text-amber-700">
                {new Date(savedFollowUp).toLocaleString("en-US", {
                  weekday: "long",
                  month:   "long",
                  day:     "numeric",
                  year:    "numeric",
                  hour:    "numeric",
                  minute:  "2-digit",
                })}
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Trigger button */}
      <Button
        variant="primary"
        icon={<Phone className="h-4 w-4" />}
        onClick={handleOpen}
      >
        Log Call
      </Button>

      {/* Modal */}
      <Modal
        open={open}
        onClose={handleClose}
        title="Log Call"
        description="Record a client call and schedule follow-ups"
        size="md"
      >
        {submitted ? (
          <SuccessScreen />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Global submit error */}
            {submitError && (
              <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                <p className="text-sm text-red-700">{submitError}</p>
              </div>
            )}

            {/* Row 1: Date/time + Duration */}
            <div className="grid grid-cols-5 gap-4">
              <div className="col-span-3">
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="call-date"
                    className="text-sm font-medium text-gray-700"
                  >
                    Date &amp; Time <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                      <CalendarClock className="h-4 w-4 text-gray-400" />
                    </span>
                    <input
                      id="call-date"
                      type="datetime-local"
                      value={form.callDate}
                      onChange={(e) => setField("callDate", e.target.value)}
                      className={cn(
                        "block w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900",
                        "focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30",
                        "transition-colors",
                        errors.callDate && "border-red-400 focus:border-red-500 focus:ring-red-500/30",
                      )}
                    />
                  </div>
                  {errors.callDate && (
                    <p className="text-xs font-medium text-red-600">{errors.callDate}</p>
                  )}
                </div>
              </div>

              <div className="col-span-2">
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="call-duration"
                    className="text-sm font-medium text-gray-700"
                  >
                    Duration (min)
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                      <Clock className="h-4 w-4 text-gray-400" />
                    </span>
                    <input
                      id="call-duration"
                      type="number"
                      min="1"
                      max="480"
                      placeholder="e.g. 15"
                      value={form.duration}
                      onChange={(e) => setField("duration", e.target.value)}
                      className={cn(
                        "block w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900",
                        "placeholder:text-gray-400",
                        "focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30",
                        "transition-colors",
                      )}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Outcome */}
            <Select
              label="Outcome"
              required
              placeholder="Select outcome…"
              options={OUTCOME_OPTIONS}
              value={form.outcome}
              onChange={(e) => setField("outcome", e.target.value)}
              error={errors.outcome}
            />

            {/* Notes */}
            <Textarea
              label="Notes"
              placeholder="Summary of the conversation, action items…"
              rows={3}
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
            />

            {/* Follow-up date — conditionally rendered when outcome = Follow-up */}
            <div
              ref={followUpRef}
              className={cn(
                "overflow-hidden transition-all duration-300 ease-in-out",
                isFollowUp
                  ? "max-h-40 opacity-100"
                  : "max-h-0 opacity-0 pointer-events-none",
              )}
            >
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Bell className="h-4 w-4 text-amber-500" />
                  <p className="text-sm font-semibold text-amber-800">
                    Schedule Follow-up Reminder
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="next-follow-up"
                    className="text-sm font-medium text-amber-800"
                  >
                    Follow-up Date &amp; Time{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="next-follow-up"
                    type="datetime-local"
                    value={form.nextFollowUp}
                    min={form.callDate}
                    onChange={(e) => setField("nextFollowUp", e.target.value)}
                    className={cn(
                      "block w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-gray-900",
                      "focus:outline-none focus:ring-2 transition-colors",
                      errors.nextFollowUp
                        ? "border-red-400 focus:border-red-500 focus:ring-red-500/30"
                        : "border-amber-300 focus:border-amber-500 focus:ring-amber-500/30",
                    )}
                  />
                  {errors.nextFollowUp && (
                    <p className="text-xs font-medium text-red-600">
                      {errors.nextFollowUp}
                    </p>
                  )}
                  <p className="text-xs text-amber-600">
                    A reminder will be saved and visible in the customer timeline.

                  </p>
                </div>
              </div>
            </div>

            {/* Footer actions */}
            <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={handleClose}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={submitting}
                icon={<Phone className="h-4 w-4" />}
              >
                Save Call
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
