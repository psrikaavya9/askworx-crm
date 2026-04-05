"use client";

import { useState } from "react";
import {
  Mail, CheckCircle2, AlertCircle, ArrowDownLeft, ArrowUpRight, Send,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { useApiClient } from "@/lib/api-client";
import { useRouter } from "next/navigation";

interface Props {
  clientId:  string;
  onSuccess?: () => void;
}

type Direction = "OUTBOUND" | "INBOUND";

interface SuccessInfo {
  direction: Direction;
  to:        string;
  subject:   string;
}

export function LogEmailModal({ clientId, onSuccess }: Props) {
  const router = useRouter();
  const api    = useApiClient();

  const [open,        setOpen]        = useState(false);
  const [direction,   setDirection]   = useState<Direction>("OUTBOUND");
  const [subject,     setSubject]     = useState("");
  const [body,        setBody]        = useState("");
  const [toEmail,     setToEmail]     = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting,  setSubmitting]  = useState(false);
  const [success,     setSuccess]     = useState<SuccessInfo | null>(null);
  const [subjectErr,  setSubjectErr]  = useState("");
  const [toEmailErr,  setToEmailErr]  = useState("");

  function handleOpen() {
    setOpen(true);
    setDirection("OUTBOUND");
    setSubject("");
    setBody("");
    setToEmail("");
    setSubmitError("");
    setSubjectErr("");
    setToEmailErr("");
    setSuccess(null);
  }

  function handleClose() {
    if (submitting) return;
    setOpen(false);
  }

  function validate(): boolean {
    let ok = true;
    if (!subject.trim()) { setSubjectErr("Subject is required."); ok = false; }
    if (direction === "OUTBOUND" && !toEmail.trim()) {
      setToEmailErr("Recipient email is required."); ok = false;
    }
    return ok;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setSubmitError("");

    try {
      if (direction === "OUTBOUND") {
        // Real send via SendGrid + auto-approved log
        await api.post("/api/email/send", {
          clientId,
          to:      toEmail.trim(),
          subject: subject.trim(),
          message: body.trim() || subject.trim(),
        });
      } else {
        // Inbound: log only (no real send)
        await api.post("/api/interactions", {
          clientId,
          type:               "EMAIL",
          date:               new Date().toISOString(),
          direction:          "INBOUND",
          messageSubject:     subject.trim(),
          messageContent:     body.trim() || undefined,
          counterpartyEmail:  toEmail.trim() || undefined,
          outcome:            "Email received",
        });
      }

      setSuccess({ direction, to: toEmail.trim(), subject: subject.trim() });
      onSuccess?.();
      router.refresh();
      setTimeout(handleClose, 2_400);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to send email");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Success screen ─────────────────────────────────────────────────────────

  function SuccessScreen({ info }: { info: SuccessInfo }) {
    const sent = info.direction === "OUTBOUND";
    return (
      <div className="flex flex-col items-center gap-5 py-8 text-center">
        <span className={cn(
          "flex h-16 w-16 items-center justify-center rounded-full",
          sent ? "bg-indigo-100" : "bg-sky-100",
        )}>
          {sent
            ? <Send className="h-7 w-7 text-indigo-600" />
            : <CheckCircle2 className="h-7 w-7 text-sky-600" />}
        </span>

        <div>
          <p className="text-base font-semibold text-gray-900">
            {sent ? "Email Sent" : "Email Logged"}
          </p>
          {sent && info.to && (
            <p className="mt-1 text-sm text-gray-500">
              Delivered to <span className="font-medium text-gray-700">{info.to}</span>
            </p>
          )}
          <p className="mt-1 text-xs text-gray-400">
            {sent
              ? "Sent via SendGrid · visible in timeline immediately"
              : "Recorded and pending review · will appear in timeline"}
          </p>
        </div>

        {/* Subject preview */}
        <div className="w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-left">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Subject</p>
          <p className="mt-0.5 text-sm text-gray-700">{info.subject}</p>
        </div>
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <>
      <Button variant="secondary" icon={<Mail className="h-4 w-4" />} onClick={handleOpen}>
        Send Email
      </Button>

      <Modal
        open={open}
        onClose={handleClose}
        title={direction === "OUTBOUND" ? "Send Email" : "Log Received Email"}
        description={
          direction === "OUTBOUND"
            ? "Compose and send a real email via SendGrid"
            : "Record an inbound email from this client"
        }
        size="md"
      >
        {success ? (
          <SuccessScreen info={success} />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Global submit error */}
            {submitError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                <p className="text-sm text-red-700">{submitError}</p>
              </div>
            )}

            {/* Direction toggle */}
            <div>
              <p className="mb-1.5 text-sm font-medium text-gray-700">Direction</p>
              <div className="flex gap-2">
                {(["OUTBOUND", "INBOUND"] as Direction[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => { setDirection(d); setToEmailErr(""); }}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-2 rounded-lg border py-2 text-sm font-medium transition-colors",
                      direction === d
                        ? d === "OUTBOUND"
                          ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                          : "border-sky-300 bg-sky-50 text-sky-700"
                        : "border-gray-200 text-gray-500 hover:bg-gray-50",
                    )}
                  >
                    {d === "OUTBOUND"
                      ? <><ArrowUpRight className="h-4 w-4" /> Send</>
                      : <><ArrowDownLeft className="h-4 w-4" /> Received</>}
                  </button>
                ))}
              </div>

              {/* Send mode banner */}
              {direction === "OUTBOUND" && (
                <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-indigo-600">
                  <Send className="h-3 w-3" />
                  Email will be sent via SendGrid from your verified sender address.
                </p>
              )}
            </div>

            {/* To / From */}
            <Input
              label={direction === "OUTBOUND" ? "To (email)" : "From (email)"}
              type="email"
              placeholder="client@example.com"
              required={direction === "OUTBOUND"}
              value={toEmail}
              onChange={(e) => { setToEmail(e.target.value); setToEmailErr(""); }}
              error={toEmailErr}
            />

            {/* Subject */}
            <Input
              label="Subject"
              required
              placeholder="Email subject…"
              value={subject}
              onChange={(e) => { setSubject(e.target.value); setSubjectErr(""); }}
              error={subjectErr}
            />

            {/* Body */}
            <Textarea
              label={direction === "OUTBOUND" ? "Message" : "Body / Summary"}
              required={direction === "OUTBOUND"}
              placeholder={
                direction === "OUTBOUND"
                  ? "Write your email message here…"
                  : "Paste or summarise the received email…"
              }
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />

            {/* Footer */}
            <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
              <Button type="button" variant="secondary" onClick={handleClose} disabled={submitting}>
                Cancel
              </Button>
              <Button
                type="submit"
                loading={submitting}
                icon={direction === "OUTBOUND" ? <Send className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
              >
                {direction === "OUTBOUND" ? "Send Email" : "Log Email"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
