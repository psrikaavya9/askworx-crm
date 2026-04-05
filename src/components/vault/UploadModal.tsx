"use client";

import { useState, useRef } from "react";
import {
  X, Upload, FileText, Calendar, Tag, Lock, CheckSquare,
  AlertCircle, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DocumentCategory, VaultAccessLevel } from "@/types/vault";
import { uploadDocument } from "@/lib/vault-api";

interface UploadModalProps {
  onClose:    () => void;
  onUploaded: () => void;
}

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

const CATEGORIES: { value: DocumentCategory; label: string; emoji: string }[] = [
  { value: "POLICY",     label: "Policy",     emoji: "🛡️" },
  { value: "CONTRACT",   label: "Contract",   emoji: "📄" },
  { value: "HANDBOOK",   label: "Handbook",   emoji: "📖" },
  { value: "FORM",       label: "Form",       emoji: "📋" },
  { value: "SOP",        label: "SOP",        emoji: "📑" },
  { value: "COMPLIANCE", label: "Compliance", emoji: "✅" },
  { value: "OTHER",      label: "Other",      emoji: "📁" },
];

const ACCESS_LEVELS: { value: VaultAccessLevel; label: string; desc: string }[] = [
  { value: "ALL",          label: "All Staff",       desc: "Everyone can view" },
  { value: "MANAGER_ONLY", label: "Managers Only",   desc: "Managers and above" },
  { value: "HR_ONLY",      label: "HR Only",         desc: "HR team only" },
  { value: "CUSTOM",       label: "Custom",          desc: "Specific staff/roles" },
];

export function UploadModal({ onClose, onUploaded }: UploadModalProps) {
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
  const [dragOver, setDragOver]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof UploadForm>(key: K, value: UploadForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
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
      onUploaded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  const fmtSize = (b: number) =>
    b >= 1_048_576 ? `${(b / 1_048_576).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white shadow-2xl shadow-purple-900/25 ring-1 ring-white/10">

        {/* Header */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between rounded-t-3xl px-7 py-5"
          style={{ background: "linear-gradient(135deg, #d25cf6 0%, #5c64f6 100%)" }}
        >
          {/* Glow orb */}
          <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 ring-1 ring-white/30 shadow-lg">
              <Upload className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">Upload Document</h2>
              <p className="text-xs text-white/65">Add a new file to the HR Vault</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 text-white transition-all hover:bg-white/30 active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-7">

          {/* Error */}
          {error && (
            <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
              <p className="text-sm font-medium text-red-700">{error}</p>
            </div>
          )}

          {/* Drop Zone */}
          <div
            className={cn(
              "relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 transition-all duration-300",
              dragOver
                ? "border-purple-400 bg-purple-50 shadow-lg shadow-purple-100/60"
                : form.file
                ? "border-emerald-300 bg-emerald-50"
                : "border-gray-200 bg-gray-50/60 hover:border-purple-300 hover:bg-purple-50/40 hover:shadow-md hover:shadow-purple-100/40"
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
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 shadow-md shadow-emerald-100/60">
                  <FileText className="h-7 w-7 text-emerald-600" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-emerald-700">{form.file.name}</p>
                  <p className="mt-0.5 text-xs text-emerald-600">{fmtSize(form.file.size)} · Click to replace</p>
                </div>
              </>
            ) : (
              <>
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-2xl shadow-md shadow-purple-200/60"
                  style={{ background: "linear-gradient(135deg, #d25cf6 0%, #5c64f6 100%)" }}
                >
                  <Upload className="h-7 w-7 text-white" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-gray-800">
                    Drop file here or <span className="text-purple-600">browse</span>
                  </p>
                  <p className="mt-1 text-xs text-gray-400">PDF, DOCX, XLSX, PPT, Images · Max 50 MB</p>
                </div>
              </>
            )}
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Document Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. Employee Handbook 2024"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-900 shadow-sm placeholder:text-gray-400 transition-all focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-100"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Brief description of this document…"
              rows={2}
              className="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 transition-all focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-100"
            />
          </div>

          {/* Category + Access Level */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                <FileText className="h-3 w-3" /> Category
              </label>
              <select
                value={form.category}
                onChange={(e) => set("category", e.target.value as DocumentCategory)}
                className="w-full cursor-pointer rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 shadow-sm transition-all focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-100"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                <Lock className="h-3 w-3" /> Access Level
              </label>
              <select
                value={form.accessLevel}
                onChange={(e) => set("accessLevel", e.target.value as VaultAccessLevel)}
                className="w-full cursor-pointer rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 shadow-sm transition-all focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-100"
              >
                {ACCESS_LEVELS.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Expiry + Tags */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                <Calendar className="h-3 w-3" /> Expiry Date
              </label>
              <input
                type="date"
                value={form.expiresAt}
                onChange={(e) => set("expiresAt", e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 shadow-sm transition-all focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-100"
              />
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                <Tag className="h-3 w-3" /> Tags
              </label>
              <input
                type="text"
                value={form.tags}
                onChange={(e) => set("tags", e.target.value)}
                placeholder="hr, policy, 2024"
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 shadow-sm placeholder:text-gray-400 transition-all focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-100"
              />
            </div>
          </div>

          {/* Requires Acknowledgement Toggle */}
          <div
            className={cn(
              "flex cursor-pointer items-center justify-between rounded-2xl border p-4 transition-all duration-300",
              form.requiresAck
                ? "border-purple-200 bg-gradient-to-r from-purple-50 to-violet-50 shadow-sm shadow-purple-100"
                : "border-gray-200 bg-gray-50/50 hover:border-purple-200 hover:bg-purple-50/30"
            )}
            onClick={() => set("requiresAck", !form.requiresAck)}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex h-9 w-9 items-center justify-center rounded-xl transition-all",
                form.requiresAck ? "bg-purple-100" : "bg-gray-100"
              )}>
                <CheckSquare className={cn(
                  "h-4.5 w-4.5 transition-colors",
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
                <p className="text-xs text-gray-500">Staff must confirm they have read this document</p>
              </div>
            </div>
            {/* Toggle switch */}
            <div className={cn(
              "relative h-6 w-11 shrink-0 rounded-full transition-all duration-300",
              form.requiresAck ? "bg-purple-600 shadow-sm shadow-purple-300" : "bg-gray-200"
            )}>
              <span className={cn(
                "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-300",
                form.requiresAck ? "translate-x-[22px]" : "translate-x-0.5"
              )} />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-50 active:scale-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || !form.file}
              className={cn(
                "flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold text-white shadow-lg transition-all duration-300",
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
        </form>
      </div>
    </div>
  );
}
