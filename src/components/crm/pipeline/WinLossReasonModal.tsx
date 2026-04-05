"use client";

import { useState, useEffect, useRef } from "react";
import { Trophy, XCircle, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

export type CloseOutcome = "WON" | "LOST";

export interface WinLossReasonModalProps {
  open:       boolean;
  outcome:    CloseOutcome;
  leadName:   string;
  stageName:  string;
  onConfirm:  (reason: string) => void;
  onCancel:   () => void;
}

const QUICK_REASONS = {
  WON:  ["Best pricing",   "Strong relationship", "Fast delivery",   "Best support",   "Right timing"],
  LOST: ["Price too high", "Chose competitor",    "Budget cut",      "No response",    "Feature gap"],
} as const;

const CONFIG = {
  WON: {
    icon:        <Trophy className="h-6 w-6 text-emerald-500" />,
    ring:        "ring-emerald-200",
    bg:          "bg-emerald-50",
    chipBg:      "bg-emerald-100 text-emerald-700 hover:bg-emerald-200",
    title:       "Mark as Won",
    label:       "Win reason",
    placeholder: "e.g. Client approved budget, best value proposition",
    confirmText: "Mark Won",
    confirmCls:  "bg-emerald-600 hover:bg-emerald-700 text-white",
  },
  LOST: {
    icon:        <XCircle className="h-6 w-6 text-red-500" />,
    ring:        "ring-red-200",
    bg:          "bg-red-50",
    chipBg:      "bg-red-100 text-red-700 hover:bg-red-200",
    title:       "Mark as Lost",
    label:       "Loss reason",
    placeholder: "e.g. Budget freeze, went with competitor",
    confirmText: "Mark Lost",
    confirmCls:  "bg-red-600 hover:bg-red-700 text-white",
  },
} as const;

export function WinLossReasonModal({
  open,
  outcome,
  leadName,
  stageName,
  onConfirm,
  onCancel,
}: WinLossReasonModalProps) {
  const [reason, setReason] = useState("");
  const [error,  setError]  = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset state whenever the modal opens
  useEffect(() => {
    if (open) {
      setReason("");
      setError("");
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  const cfg = CONFIG[outcome];

  function handleConfirm() {
    if (!reason.trim()) {
      setError("Please enter a reason before continuing.");
      textareaRef.current?.focus();
      return;
    }
    onConfirm(reason.trim());
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") onCancel();
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleConfirm();
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      onKeyDown={handleKeyDown}
    >
      <div className={`w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ${cfg.ring}`}>
        {/* Header */}
        <div className={`flex items-start justify-between rounded-t-2xl ${cfg.bg} px-5 py-4`}>
          <div className="flex items-center gap-3">
            {cfg.icon}
            <div>
              <p className="text-sm font-bold text-slate-800">{cfg.title}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Moving <span className="font-semibold text-slate-700">{leadName}</span> → {stageName}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="rounded-lg p-1 text-slate-400 hover:bg-white/70 hover:text-slate-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <label className="mb-1.5 block text-xs font-semibold text-slate-600 uppercase tracking-wide">
            {cfg.label} <span className="text-red-500">*</span>
          </label>
          {/* Quick-pick chips */}
          <div className="mb-2 flex flex-wrap gap-1.5">
            {QUICK_REASONS[outcome].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => { setReason(q); if (error) setError(""); textareaRef.current?.focus(); }}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${cfg.chipBg}`}
              >
                {q}
              </button>
            ))}
          </div>

          <textarea
            ref={textareaRef}
            value={reason}
            onChange={(e) => { setReason(e.target.value); if (error) setError(""); }}
            placeholder={cfg.placeholder}
            rows={3}
            className={`w-full resize-none rounded-lg border px-3 py-2 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 transition-colors ${
              error
                ? "border-red-300 focus:ring-red-200"
                : "border-slate-200 focus:border-indigo-400 focus:ring-indigo-100"
            }`}
          />
          {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
          <p className="mt-1.5 text-[11px] text-slate-400">Tip: click a chip or type your own · ⌘ Enter to confirm</p>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${cfg.confirmCls}`}
          >
            {cfg.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
