"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  MapPin, Upload, X, CheckCircle2, AlertCircle, Loader2, Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/Toaster";
import { useApiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { EXPENSE_CATEGORIES, PAYMENT_MODES } from "@/modules/finance/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClientOption  { id: string; name: string; }
interface ProjectOption { id: string; name: string; }

interface Props {
  clients:  ClientOption[];
  projects: ProjectOption[];
  onSuccess: () => void;
}

type GpsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok";    lat: number; lng: number }
  | { status: "error"; message: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TODAY = new Date().toISOString().split("T")[0];

function todayMax() {
  return TODAY;
}

// ---------------------------------------------------------------------------
// DropZone — native HTML5 drag-and-drop, no external dependencies
// ---------------------------------------------------------------------------

interface DropZoneProps {
  file:     File | null;
  onChange: (f: File | null) => void;
  disabled: boolean;
}

function DropZone({ file, onChange, disabled }: DropZoneProps) {
  const inputRef  = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files?.length) return;
    const f = files[0];
    if (!f.type.startsWith("image/")) {
      toast.error("Invalid file type", "Only image files are accepted.");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast.error("File too large", "Maximum receipt size is 5 MB.");
      return;
    }
    onChange(f);
  }, [onChange]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (!disabled) handleFiles(e.dataTransfer.files);
  }, [disabled, handleFiles]);

  const preview = file ? URL.createObjectURL(file) : null;

  return (
    <div>
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        disabled={disabled}
      />

      {file ? (
        /* Preview */
        <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview!}
            alt="Receipt preview"
            className="max-h-48 w-full object-contain"
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            disabled={disabled}
            className="absolute right-2 top-2 rounded-full bg-white p-1 shadow-md hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
          <p className="truncate px-3 py-2 text-xs text-gray-500">{file.name}</p>
        </div>
      ) : (
        /* Drop target */
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          disabled={disabled}
          className={cn(
            "flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors",
            dragging
              ? "border-indigo-400 bg-indigo-50"
              : "border-gray-200 bg-gray-50 hover:border-indigo-300 hover:bg-indigo-50/40",
            disabled && "pointer-events-none opacity-50"
          )}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm">
            <Upload className="h-5 w-5 text-gray-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700">
              {dragging ? "Drop receipt here" : "Upload receipt"}
            </p>
            <p className="mt-0.5 text-xs text-gray-400">
              Drag & drop or click — PNG, JPG, WEBP up to 5 MB
            </p>
          </div>
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// GpsCapture — shows status pill
// ---------------------------------------------------------------------------

function GpsCapture({ gps }: { gps: GpsState }) {
  if (gps.status === "idle") return null;

  if (gps.status === "loading")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Capturing location…
      </span>
    );

  if (gps.status === "ok")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Location captured ({gps.lat.toFixed(4)}, {gps.lng.toFixed(4)})
      </span>
    );

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
      <AlertCircle className="h-3.5 w-3.5" />
      {gps.message}
    </span>
  );
}

// ---------------------------------------------------------------------------
// ExpenseForm
// ---------------------------------------------------------------------------

export function ExpenseForm({ clients, projects, onSuccess }: Props) {
  const api = useApiClient();
  const { getToken, refreshToken: doRefresh } = useAuth();

  // ── Form state ────────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    date:        TODAY,
    category:    "",
    amount:      "",
    description: "",
    paymentMode: "",
    clientId:    "",
    projectId:   "",
  });
  const [receiptFile, setReceiptFile]   = useState<File | null>(null);
  const [gps, setGps]                   = useState<GpsState>({ status: "idle" });
  const [submitting, setSubmitting]     = useState(false);
  const [descError, setDescError]       = useState("");

  // ── Auto-capture GPS on mount ─────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) {
      setGps({ status: "error", message: "Geolocation not supported by this browser" });
      return;
    }
    setGps({ status: "loading" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ status: "ok", lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        const messages: Record<number, string> = {
          1: "Location access denied",
          2: "Location unavailable",
          3: "Location request timed out",
        };
        setGps({ status: "error", message: messages[err.code] ?? "Location unavailable" });
      },
      { timeout: 10_000, enableHighAccuracy: true }
    );
  }, []);

  // ── Field helpers ─────────────────────────────────────────────────────────
  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validateDescription() {
    if (form.description && form.description.trim().length > 0 && form.description.trim().length < 10) {
      setDescError("Description must be at least 10 characters");
      return false;
    }
    setDescError("");
    return true;
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateDescription()) return;

    setSubmitting(true);
    try {
      // ── Step 1: upload receipt if present ──────────────────────────────
      let receiptUrl: string | undefined;
      if (receiptFile) {
        const fd = new FormData();
        fd.append("file", receiptFile);
        // Get a fresh token — api-client only handles JSON, so we use fetch directly here
        let token = getToken();
        if (!token) token = await doRefresh();
        if (!token) throw new Error("Session expired. Please log in again.");

        const uploadRes = await fetch("/api/expenses/upload", {
          method:  "POST",
          headers: { Authorization: `Bearer ${token}` },
          body:    fd,
        });
        const uploadData = await uploadRes.json() as { success?: boolean; url?: string; error?: string };
        if (!uploadRes.ok || !uploadData.url) {
          throw new Error(uploadData.error ?? "Receipt upload failed");
        }
        receiptUrl = uploadData.url;
      }

      // ── Step 2: submit expense ──────────────────────────────────────────
      await api.post("/api/expenses/staff", {
        date:        form.date,
        category:    form.category,
        amount:      parseFloat(form.amount),
        description: form.description || undefined,
        paymentMode: form.paymentMode || undefined,
        clientId:    form.clientId   || undefined,
        projectId:   form.projectId  || undefined,
        receiptUrl,
        gpsLat: gps.status === "ok" ? gps.lat : undefined,
        gpsLng: gps.status === "ok" ? gps.lng : undefined,
      });

      toast.success("Expense submitted!", "Your expense has been recorded successfully.");
      // Reset form
      setForm({ date: TODAY, category: "", amount: "", description: "", paymentMode: "", clientId: "", projectId: "" });
      setReceiptFile(null);
      onSuccess();
    } catch (err) {
      toast.error("Submission failed", (err as Error).message ?? "Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Section header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
          <Receipt className="h-5 w-5 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-base font-bold text-gray-900">Submit Expense</h2>
          <p className="text-xs text-gray-500">Fill in the details below and attach your receipt</p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">

        {/* GPS status */}
        <div className="mb-5 flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          <GpsCapture gps={gps} />
        </div>

        {/* Row 1: Date + Category */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700">
              Expense Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              max={todayMax()}
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
              disabled={submitting}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
              disabled={submitting}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors"
            >
              <option value="">Select category</option>
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Amount + Payment Mode */}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700">
              Amount (₹) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">₹</span>
              <input
                type="number"
                required
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => set("amount", e.target.value)}
                disabled={submitting}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-7 pr-3 text-sm text-gray-900 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700">
              Payment Mode <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={form.paymentMode}
              onChange={(e) => set("paymentMode", e.target.value)}
              disabled={submitting}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors"
            >
              <option value="">Select mode</option>
              {PAYMENT_MODES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Description */}
        <div className="mt-4">
          <label className="mb-1.5 block text-sm font-semibold text-gray-700">
            Description
            <span className="ml-1 text-xs font-normal text-gray-400">(min 10 characters)</span>
          </label>
          <textarea
            rows={3}
            placeholder="Briefly describe this expense…"
            value={form.description}
            onChange={(e) => { set("description", e.target.value); setDescError(""); }}
            onBlur={validateDescription}
            disabled={submitting}
            className={cn(
              "w-full resize-none rounded-xl border bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 transition-colors",
              descError
                ? "border-red-300 focus:border-red-400 focus:ring-red-200"
                : "border-gray-200 focus:border-indigo-500 focus:ring-indigo-500/20"
            )}
          />
          {descError && (
            <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
              <AlertCircle className="h-3 w-3" /> {descError}
            </p>
          )}
        </div>

        {/* Optional: Client + Project */}
        {(clients.length > 0 || projects.length > 0) && (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {clients.length > 0 && (
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Client <span className="text-xs font-normal text-gray-400">(optional)</span>
                </label>
                <select
                  value={form.clientId}
                  onChange={(e) => set("clientId", e.target.value)}
                  disabled={submitting}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors"
                >
                  <option value="">None</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {projects.length > 0 && (
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Project <span className="text-xs font-normal text-gray-400">(optional)</span>
                </label>
                <select
                  value={form.projectId}
                  onChange={(e) => set("projectId", e.target.value)}
                  disabled={submitting}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors"
                >
                  <option value="">None</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Receipt upload */}
        <div className="mt-4">
          <label className="mb-1.5 block text-sm font-semibold text-gray-700">
            Receipt
            <span className="ml-1 text-xs font-normal text-gray-400">(optional — image, max 5 MB)</span>
          </label>
          <DropZone file={receiptFile} onChange={setReceiptFile} disabled={submitting} />
        </div>

        {/* Submit button */}
        <div className="mt-6">
          <button
            type="submit"
            disabled={submitting}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white shadow-sm transition-all",
              submitting
                ? "cursor-not-allowed bg-indigo-400"
                : "bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99]"
            )}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting…
              </>
            ) : (
              "Submit Expense"
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
