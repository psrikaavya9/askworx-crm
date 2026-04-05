"use client";

/**
 * Lightweight module-level toast system — no context required.
 *
 * Usage:
 *   import { toast }    from "@/components/ui/Toaster";   // fire toasts
 *   import { Toaster }  from "@/components/ui/Toaster";   // add to layout
 *
 *   toast.success("Saved!");
 *   toast.error("Failed.");
 *   toast.info("Loading…");
 */

import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id:      string;
  type:    ToastType;
  title:   string;
  message?: string;
}

// ---------------------------------------------------------------------------
// Module-level store (works across module boundaries)
// ---------------------------------------------------------------------------

let _listeners: Set<(t: ToastItem[]) => void> = new Set();
let _toasts: ToastItem[] = [];

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function push(type: ToastType, title: string, message?: string) {
  const item: ToastItem = { id: uid(), type, title, message };
  _toasts = [item, ..._toasts].slice(0, 5); // max 5 toasts
  _listeners.forEach((fn) => fn([..._toasts]));

  // Auto-dismiss after 4 s
  setTimeout(() => remove(item.id), 4000);
}

function remove(id: string) {
  _toasts = _toasts.filter((t) => t.id !== id);
  _listeners.forEach((fn) => fn([..._toasts]));
}

export const toast = {
  success: (title: string, message?: string) => push("success", title, message),
  error:   (title: string, message?: string) => push("error",   title, message),
  info:    (title: string, message?: string) => push("info",    title, message),
};

// ---------------------------------------------------------------------------
// Config per type
// ---------------------------------------------------------------------------

const CONFIG: Record<ToastType, {
  icon:      React.ReactNode;
  bar:       string;
  iconBg:    string;
  border:    string;
}> = {
  success: {
    icon:   <CheckCircle2 className="h-5 w-5 text-emerald-600" />,
    bar:    "bg-emerald-500",
    iconBg: "bg-emerald-50",
    border: "border-emerald-200",
  },
  error: {
    icon:   <XCircle className="h-5 w-5 text-red-600" />,
    bar:    "bg-red-500",
    iconBg: "bg-red-50",
    border: "border-red-200",
  },
  info: {
    icon:   <Info className="h-5 w-5 text-purple-600" />,
    bar:    "bg-purple-500",
    iconBg: "bg-purple-50",
    border: "border-purple-200",
  },
};

// ---------------------------------------------------------------------------
// Single toast card
// ---------------------------------------------------------------------------

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);
  const cfg = CONFIG[item.type];

  useEffect(() => {
    // mount → fade in
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <div
      className={cn(
        "relative flex w-80 max-w-full items-start gap-3 overflow-hidden rounded-2xl border bg-white px-4 py-3.5 shadow-xl shadow-black/10 transition-all duration-500",
        cfg.border,
        visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      )}
    >
      {/* Progress bar (shrinks over 4 s) */}
      <div className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden rounded-b-2xl bg-gray-100">
        <div
          className={cn("h-full origin-left", cfg.bar)}
          style={{ animation: "shrink 4s linear forwards" }}
        />
      </div>

      {/* Icon */}
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", cfg.iconBg)}>
        {cfg.icon}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-sm font-bold text-gray-900 leading-snug">{item.title}</p>
        {item.message && (
          <p className="mt-0.5 text-xs text-gray-500 leading-snug">{item.message}</p>
        )}
      </div>

      {/* Dismiss */}
      <button
        onClick={onDismiss}
        className="shrink-0 rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toaster — add once to your layout
// ---------------------------------------------------------------------------

export function Toaster() {
  const [list, setList] = useState<ToastItem[]>([]);

  const sync = useCallback((t: ToastItem[]) => setList(t), []);

  useEffect(() => {
    _listeners.add(sync);
    return () => { _listeners.delete(sync); };
  }, [sync]);

  if (list.length === 0) return null;

  return (
    <>
      {/* Global keyframe injection */}
      <style>{`
        @keyframes shrink {
          from { transform: scaleX(1); }
          to   { transform: scaleX(0); }
        }
      `}</style>

      <div
        aria-live="polite"
        className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2"
      >
        {list.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={() => remove(item.id)} />
        ))}
      </div>
    </>
  );
}
