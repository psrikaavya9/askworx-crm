"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Upload, FileText, Calendar, Tag, Lock, CheckSquare,
  AlertCircle, ArrowLeft, Sparkles, FolderLock, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DocumentCategory, VaultAccessLevel } from "@/types/vault";
import { uploadDocument } from "@/lib/vault-api";

interface UploadForm {
  title:       string;
  description: string;
  category:    DocumentCategory;
  accessLevel: VaultAccessLevel;
  requiresAck: boolean;
  expiresAt:   string;
  tags:        string;
  file:        File | null;
}

const CATEGORIES: { value: DocumentCategory; label: string; emoji: string; desc: string }[] = [
  { value: "POLICY",     label: "Policy",     emoji: "🛡️", desc: "Company policies" },
  { value: "CONTRACT",   label: "Contract",   emoji: "📄", desc: "Legal contracts" },
  { value: "HANDBOOK",   label: "Handbook",   emoji: "📖", desc: "Staff handbooks" },
  { value: "FORM",       label: "Form",       emoji: "📋", desc: "HR forms" },
  { value: "SOP",        label: "SOP",        emoji: "📑", desc: "Procedures" },
  { value: "COMPLIANCE", label: "Compliance", emoji: "✅", desc: "Compliance docs" },
  { value: "OTHER",      label: "Other",      emoji: "📁", desc: "General docs" },
];

const ACCESS_LEVELS: { value: VaultAccessLevel; label: string; desc: string; icon: string }[] = [
  { value: "ALL",          label: "All Staff",     desc: "Visible to everyone",         icon: "👥" },
  { value: "MANAGER_ONLY", label: "Managers Only", desc: "Managers and above",           icon: "👔" },
  { value: "HR_ONLY",      label: "HR Only",       desc: "HR team only",                icon: "🔒" },
  { value: "CUSTOM",       label: "Custom",        desc: "Specific staff / roles",      icon: "⚙️" },
];

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
      {children}
    </label>
  );
}

function inputCls(focus = true) {
  return cn(
    "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 shadow-sm",
    "placeholder:text-gray-400 transition-all",
    focus && "focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-100"
  );
}

export default function VaultUploadPage() {
  const router = useRouter();

  const [form, setForm] = useState<UploadForm>({
    title:       "",
    description: "",
    category:    "POLICY",
    accessLevel: "ALL",
    requiresAck: false,
    expiresAt:   "",
    tags:        "",
    file:        null,
  });
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [success, setSuccess]     = useState(false);
  const [dragOver, setDragOver]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof UploadForm>(key: K, val: UploadForm[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function handleFile(file: File) {
    set("file", file);
    if (!form.title) set("title", file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.file)         { setError("Please select a file to upload."); return; }
    if (!form.title.trim()) { setError("Document title is required.");    return; }

    setUploading(true);
    setError(null);
    try {
      await uploadDocument(form.file, {
        title:       form.title.trim(),
        description: form.description.trim() || undefined,
        category:    form.category,
        accessLevel: form.accessLevel,
        requiresAck: form.requiresAck,
        expiresAt:   form.expiresAt || undefined,
        tags:        form.tags.trim() || undefined,
      });
      setSuccess(true);
      setTimeout(() => router.push("/vault"), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  const fmtSize = (b: number) =>
    b >= 1_048_576 ? `${(b / 1_048_576).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`;

  // ── Success overlay ──────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
        <div
          className="flex h-24 w-24 items-center justify-center rounded-3xl shadow-2xl shadow-purple-300/50"
          style={{ background: "linear-gradient(135deg, #d25cf6 0%, #5c64f6 100%)" }}
        >
          <Sparkles className="h-12 w-12 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900">Document Uploaded!</h2>
          <p className="mt-2 text-sm text-gray-500">Redirecting you to the vault…</p>
        </div>
        <div className="h-1 w-48 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full animate-pulse rounded-full"
            style={{ background: "linear-gradient(90deg, #d25cf6, #5c64f6)", width: "100%" }}
          />
        </div>
      </div>
    );
  }

  // ── Main form ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <div className="relative overflow-hidden rounded-2xl border border-white/30 shadow-xl shadow-purple-900/20">
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(135deg, #d25cf6 0%, #5c64f6 100%)" }}
        />
        <div className="pointer-events-none absolute -right-10 -top-10 h-52 w-52 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-8 bottom-0 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />

        <div className="relative flex items-center justify-between px-8 py-6">
          <div className="flex items-center gap-4">
            <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-white/20 ring-2 ring-white/30 shadow-lg">
              <FolderLock className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-white">Upload Document</h1>
              <p className="mt-0.5 text-sm text-white/70">Add a new file to the secure HR Vault</p>
            </div>
          </div>
          <Link
            href="/vault"
            className="flex items-center gap-2 rounded-xl bg-white/20 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/30 transition-all hover:bg-white/30 hover:-translate-y-0.5"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Vault
          </Link>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      </div>

      {/* ── Form card ── */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl bg-white shadow-lg shadow-gray-100/80 ring-1 ring-gray-100 overflow-hidden"
      >
        {/* Section: File */}
        <div className="border-b border-gray-100 p-6 md:p-8">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-extrabold uppercase tracking-widest text-gray-400">
            <span
              className="flex h-6 w-6 items-center justify-center rounded-lg text-white text-xs font-bold"
              style={{ background: "linear-gradient(135deg, #d25cf6 0%, #5c64f6 100%)" }}
            >1</span>
            Select File
          </h2>

          {error && (
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
              <p className="text-sm font-medium text-red-700">{error}</p>
              <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Drop zone */}
          <div
            className={cn(
              "relative flex cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed py-12 transition-all duration-300",
              dragOver
                ? "border-purple-400 bg-purple-50 shadow-xl shadow-purple-100/60"
                : form.file
                ? "border-emerald-300 bg-emerald-50"
                : "border-gray-200 bg-gray-50/40 hover:border-purple-300 hover:bg-purple-50/40 hover:shadow-lg hover:shadow-purple-100/40"
            )}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files[0];
              if (f) handleFile(f);
            }}
          >
            <input
              ref={fileRef}
              type="file"
              className="sr-only"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            {form.file ? (
              <>
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 shadow-lg shadow-emerald-100/60">
                  <FileText className="h-8 w-8 text-emerald-600" />
                </div>
                <div className="text-center">
                  <p className="text-base font-bold text-emerald-700">{form.file.name}</p>
                  <p className="mt-0.5 text-sm text-emerald-600">{fmtSize(form.file.size)} · Click to replace</p>
                </div>
              </>
            ) : (
              <>
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg shadow-purple-200/60"
                  style={{ background: "linear-gradient(135deg, #d25cf6 0%, #5c64f6 100%)" }}
                >
                  <Upload className="h-8 w-8 text-white" />
                </div>
                <div className="text-center">
                  <p className="text-base font-bold text-gray-800">
                    Drop your file here, or{" "}
                    <span className="text-purple-600 underline decoration-dotted underline-offset-2">browse</span>
                  </p>
                  <p className="mt-1.5 text-sm text-gray-400">PDF, DOCX, XLSX, PPT, Images · Max 50 MB</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Section: Document details */}
        <div className="border-b border-gray-100 p-6 md:p-8">
          <h2 className="mb-5 flex items-center gap-2 text-sm font-extrabold uppercase tracking-widest text-gray-400">
            <span
              className="flex h-6 w-6 items-center justify-center rounded-lg text-white text-xs font-bold"
              style={{ background: "linear-gradient(135deg, #d25cf6 0%, #5c64f6 100%)" }}
            >2</span>
            Document Details
          </h2>

          <div className="space-y-5">
            {/* Title */}
            <div>
              <FieldLabel>Title <span className="text-red-400 normal-case font-normal">*</span></FieldLabel>
              <input
                type="text"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="e.g. Employee Handbook 2024"
                className={inputCls()}
              />
            </div>

            {/* Description */}
            <div>
              <FieldLabel>Description</FieldLabel>
              <textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Briefly describe this document…"
                rows={3}
                className={cn(inputCls(), "resize-none")}
              />
            </div>

            {/* Category */}
            <div>
              <FieldLabel>Category</FieldLabel>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => set("category", c.value)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-xs font-semibold transition-all duration-200 hover:-translate-y-0.5",
                      form.category === c.value
                        ? "border-purple-300 bg-purple-50 text-purple-700 shadow-md shadow-purple-100/60"
                        : "border-gray-200 bg-gray-50 text-gray-600 hover:border-purple-200 hover:bg-purple-50/40 hover:text-purple-700"
                    )}
                  >
                    <span className="text-lg leading-none">{c.emoji}</span>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Expiry + Tags */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel><Calendar className="inline h-3 w-3 mr-1" />Expiry Date</FieldLabel>
                <input
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) => set("expiresAt", e.target.value)}
                  className={inputCls()}
                />
              </div>
              <div>
                <FieldLabel><Tag className="inline h-3 w-3 mr-1" />Tags</FieldLabel>
                <input
                  type="text"
                  value={form.tags}
                  onChange={(e) => set("tags", e.target.value)}
                  placeholder="hr, policy, 2024 (comma-separated)"
                  className={inputCls()}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section: Access & Settings */}
        <div className="p-6 md:p-8">
          <h2 className="mb-5 flex items-center gap-2 text-sm font-extrabold uppercase tracking-widest text-gray-400">
            <span
              className="flex h-6 w-6 items-center justify-center rounded-lg text-white text-xs font-bold"
              style={{ background: "linear-gradient(135deg, #d25cf6 0%, #5c64f6 100%)" }}
            >3</span>
            Access & Settings
          </h2>

          {/* Access level */}
          <div className="mb-5">
            <FieldLabel><Lock className="inline h-3 w-3 mr-1" />Access Level</FieldLabel>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {ACCESS_LEVELS.map((a) => (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => set("accessLevel", a.value)}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-2xl border p-4 text-left transition-all duration-200",
                    form.accessLevel === a.value
                      ? "border-purple-300 bg-purple-50 shadow-md shadow-purple-100/50"
                      : "border-gray-200 bg-gray-50/50 hover:border-purple-200 hover:bg-purple-50/30 hover:-translate-y-0.5"
                  )}
                >
                  <span className="text-xl leading-none">{a.icon}</span>
                  <span className={cn(
                    "text-sm font-bold",
                    form.accessLevel === a.value ? "text-purple-700" : "text-gray-700"
                  )}>
                    {a.label}
                  </span>
                  <span className="text-xs text-gray-500 leading-tight">{a.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Requires acknowledgement */}
          <div
            className={cn(
              "flex cursor-pointer items-center justify-between rounded-2xl border p-5 transition-all duration-300",
              form.requiresAck
                ? "border-purple-200 bg-gradient-to-r from-purple-50 to-violet-50 shadow-sm shadow-purple-100"
                : "border-gray-200 bg-gray-50/50 hover:border-purple-200 hover:bg-purple-50/30"
            )}
            onClick={() => set("requiresAck", !form.requiresAck)}
          >
            <div className="flex items-center gap-4">
              <div className={cn(
                "flex h-11 w-11 items-center justify-center rounded-xl transition-all",
                form.requiresAck ? "bg-purple-100 shadow-sm shadow-purple-200" : "bg-gray-100"
              )}>
                <CheckSquare className={cn(
                  "h-5 w-5 transition-colors",
                  form.requiresAck ? "text-purple-600" : "text-gray-400"
                )} />
              </div>
              <div>
                <p className={cn(
                  "text-sm font-bold transition-colors",
                  form.requiresAck ? "text-purple-700" : "text-gray-700"
                )}>
                  Requires Acknowledgement
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  Staff must digitally confirm they have read and understood this document
                </p>
              </div>
            </div>
            <div className={cn(
              "relative h-7 w-13 shrink-0 rounded-full transition-all duration-300",
              form.requiresAck
                ? "bg-purple-600 shadow-sm shadow-purple-300"
                : "bg-gray-200"
            )}>
              <span className={cn(
                "absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-300",
                form.requiresAck ? "translate-x-[27px]" : "translate-x-1"
              )} />
            </div>
          </div>

          {/* Submit */}
          <div className="mt-6 flex items-center justify-end gap-3">
            <Link
              href="/vault"
              className="rounded-xl border border-gray-200 bg-white px-6 py-2.5 text-sm font-semibold text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-50 active:scale-95"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={uploading || !form.file}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-7 py-2.5 text-sm font-bold text-white shadow-lg transition-all duration-300",
                uploading || !form.file
                  ? "cursor-not-allowed bg-gray-300 text-gray-400 shadow-none"
                  : "shadow-purple-200 hover:-translate-y-0.5 hover:brightness-110 hover:shadow-xl active:scale-95"
              )}
              style={uploading || !form.file ? {} : { background: "linear-gradient(135deg, #d25cf6 0%, #5c64f6 100%)" }}
            >
              {uploading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Uploading…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Upload to Vault
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
