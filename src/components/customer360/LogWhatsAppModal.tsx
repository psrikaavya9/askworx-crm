"use client";

import { useState } from "react";
import {
  MessageCircle, CheckCircle2, AlertCircle,
  ArrowDownLeft, ArrowUpRight, Send,
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
  phone:     string;
  preview:   string;
}

export function LogWhatsAppModal({ clientId, onSuccess }: Props) {
  const router = useRouter();
  const api    = useApiClient();

  const [open,        setOpen]        = useState(false);
  const [direction,   setDirection]   = useState<Direction>("OUTBOUND");
  const [message,     setMessage]     = useState("");
  const [phone,       setPhone]       = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting,  setSubmitting]  = useState(false);
  const [success,     setSuccess]     = useState<SuccessInfo | null>(null);
  const [msgError,    setMsgError]    = useState("");
  const [phoneErr,    setPhoneErr]    = useState("");

  function handleOpen() {
    setOpen(true);
    setDirection("OUTBOUND");
    setMessage("");
    setPhone("");
    setSubmitError("");
    setMsgError("");
    setPhoneErr("");
    setSuccess(null);
  }

  function handleClose() {
    if (submitting) return;
    setOpen(false);
  }

  function validate(): boolean {
    let ok = true;
    if (!message.trim()) { setMsgError("Message is required."); ok = false; }
    if (direction === "OUTBOUND") {
      if (!phone.trim()) {
        setPhoneErr("Phone number is required."); ok = false;
      } else if (!/^\+[1-9]\d{6,14}$/.test(phone.trim())) {
        setPhoneErr("Use E.164 format — e.g. +919876543210"); ok = false;
      }
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
        // Real send via Twilio + auto-approved log
        await api.post("/api/whatsapp/send", {
          clientId,
          phone:   phone.trim(),
          message: message.trim(),
        });
      } else {
        // Inbound: log only
        await api.post("/api/interactions", {
          clientId,
          type:               "WHATSAPP",
          date:               new Date().toISOString(),
          direction:          "INBOUND",
          messageContent:     message.trim(),
          counterpartyPhone:  phone.trim() || undefined,
          outcome:            "WhatsApp received",
        });
      }

      setSuccess({ direction, phone: phone.trim(), preview: message.trim() });
      onSuccess?.();
      router.refresh();
      setTimeout(handleClose, 2_400);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to send WhatsApp");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Success screen ─────────────────────────────────────────────────────────

  function SuccessScreen({ info }: { info: SuccessInfo }) {
    const sent = info.direction === "OUTBOUND";
    return (
      <div className="flex flex-col items-center gap-5 py-8 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          {sent
            ? <Send className="h-7 w-7 text-green-600" />
            : <CheckCircle2 className="h-7 w-7 text-green-600" />}
        </span>

        <div>
          <p className="text-base font-semibold text-gray-900">
            {sent ? "WhatsApp Sent" : "Message Logged"}
          </p>
          {sent && info.phone && (
            <p className="mt-1 text-sm text-gray-500">
              Delivered to <span className="font-medium text-gray-700">{info.phone}</span>
            </p>
          )}
          <p className="mt-1 text-xs text-gray-400">
            {sent
              ? "Sent via Twilio · visible in timeline immediately"
              : "Recorded and pending review · will appear in timeline"}
          </p>
        </div>

        {/* Message preview */}
        <div className="w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-left">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Message</p>
          <p className="mt-0.5 line-clamp-3 text-sm text-gray-700">{info.preview}</p>
        </div>
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <>
      <Button variant="secondary" icon={<MessageCircle className="h-4 w-4" />} onClick={handleOpen}>
        WhatsApp
      </Button>

      <Modal
        open={open}
        onClose={handleClose}
        title={direction === "OUTBOUND" ? "Send WhatsApp" : "Log Received WhatsApp"}
        description={
          direction === "OUTBOUND"
            ? "Send a real WhatsApp message via Twilio"
            : "Record an inbound WhatsApp message from this client"
        }
        size="sm"
      >
        {success ? (
          <SuccessScreen info={success} />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Global error */}
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
                    onClick={() => { setDirection(d); setPhoneErr(""); }}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-2 rounded-lg border py-2 text-sm font-medium transition-colors",
                      direction === d
                        ? "border-green-300 bg-green-50 text-green-700"
                        : "border-gray-200 text-gray-500 hover:bg-gray-50",
                    )}
                  >
                    {d === "OUTBOUND"
                      ? <><ArrowUpRight className="h-4 w-4" /> Send</>
                      : <><ArrowDownLeft className="h-4 w-4" /> Received</>}
                  </button>
                ))}
              </div>

              {direction === "OUTBOUND" && (
                <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-green-700">
                  <Send className="h-3 w-3" />
                  Message will be sent via Twilio WhatsApp.
                </p>
              )}
            </div>

            {/* Phone */}
            <Input
              label={direction === "OUTBOUND" ? "To (phone)" : "From (phone)"}
              type="tel"
              placeholder="+919876543210"
              required={direction === "OUTBOUND"}
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setPhoneErr(""); }}
              error={phoneErr}
            />
            {direction === "OUTBOUND" && !phoneErr && (
              <p className="-mt-2 text-[11px] text-gray-400">E.164 format required — include country code</p>
            )}

            {/* Message */}
            <Textarea
              label="Message"
              required
              placeholder={
                direction === "OUTBOUND"
                  ? "Type your WhatsApp message…"
                  : "Paste or summarise the received message…"
              }
              rows={4}
              value={message}
              onChange={(e) => { setMessage(e.target.value); setMsgError(""); }}
              error={msgError}
            />

            {/* Footer */}
            <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
              <Button type="button" variant="secondary" onClick={handleClose} disabled={submitting}>
                Cancel
              </Button>
              <Button
                type="submit"
                loading={submitting}
                icon={direction === "OUTBOUND" ? <Send className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
              >
                {direction === "OUTBOUND" ? "Send WhatsApp" : "Log Message"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
