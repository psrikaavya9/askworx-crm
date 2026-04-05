"use client";

import { useState, useEffect } from "react";
import {
  X, Download, ExternalLink, ShieldCheck, GitBranch,
  Clock, Users, AlertTriangle, CheckCircle2, FileText,
  BookOpen, ClipboardList, ListOrdered, CheckSquare,
  Shield, File, Loader2, XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge }     from "./StatusBadge";
import { SignatureModal }  from "./SignatureModal";
import { getAckStatus }    from "@/lib/vault-api";
import type { HrDocument, DocumentCategory, DocAcknowledgement } from "@/types/vault";
import { toast } from "@/components/ui/Toaster";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const categoryConfig: Record<DocumentCategory, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
  POLICY:     { icon: <Shield className="h-4 w-4" />,       color: "text-purple-600", bg: "bg-purple-50",  label: "Policy" },
  CONTRACT:   { icon: <FileText className="h-4 w-4" />,     color: "text-blue-600",   bg: "bg-blue-50",    label: "Contract" },
  HANDBOOK:   { icon: <BookOpen className="h-4 w-4" />,     color: "text-indigo-600", bg: "bg-indigo-50",  label: "Handbook" },
  FORM:       { icon: <ClipboardList className="h-4 w-4" />,color: "text-cyan-600",   bg: "bg-cyan-50",    label: "Form" },
  SOP:        { icon: <ListOrdered className="h-4 w-4" />,  color: "text-teal-600",   bg: "bg-teal-50",    label: "SOP" },
  COMPLIANCE: { icon: <CheckSquare className="h-4 w-4" />,  color: "text-green-600",  bg: "bg-green-50",   label: "Compliance" },
  OTHER:      { icon: <File className="h-4 w-4" />,         color: "text-gray-600",   bg: "bg-gray-50",    label: "Other" },
};

function fmtSize(bytes: number) {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024)     return `${(bytes / 1_024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function ExpiryChip({ expiresAt }: { expiresAt: string | null }) {
  if (!expiresAt) return null;
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
  if (days < 0)  return <span className="flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700"><AlertTriangle className="h-3 w-3" /> Expired {Math.abs(days)}d ago</span>;
  if (days <= 30) return <span className="flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-700"><Clock className="h-3 w-3" /> {days}d left</span>;
  return <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500"><Clock className="h-3 w-3" /> Expires {fmtDate(expiresAt)}</span>;
}

/** Get two-letter initials from a name string */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/** Deterministic pastel hue for an avatar based on id */
function avatarHue(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 60%, 88%)`;
}
function avatarTextHue(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 35%)`;
}

// ---------------------------------------------------------------------------
// Staff map helper (for admin name resolution)
// ---------------------------------------------------------------------------

interface StaffRecord {
  id:        string;
  firstName: string;
  lastName:  string;
  role?:     string;
}

async function fetchStaffMap(): Promise<Map<string, StaffRecord>> {
  try {
    const res = await fetch("/api/staff?pageSize=100");
    if (!res.ok) return new Map();
    const json = await res.json() as { data: StaffRecord[] };
    const map = new Map<string, StaffRecord>();
    for (const s of json.data ?? []) map.set(s.id, s);
    return map;
  } catch {
    return new Map();
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AckInfo {
  acknowledged:      boolean;
  acknowledgedAt?:   string;
  acknowledgedCount: number;
  acknowledgements:  DocAcknowledgement[];
  totalStaff:        number;
  staffMap:          Map<string, StaffRecord>;
}

interface DocumentViewerModalProps {
  doc:              HrDocument;
  isAdmin?:         boolean;
  onClose:          () => void;
  onAcknowledged?:  (docId: string) => void;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Animated progress bar */
function AckProgressBar({ signed, total }: { signed: number; total: number }) {
  const pct = total > 0 ? Math.round((signed / total) * 100) : 0;
  const allDone = signed >= total && total > 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-700">
          <span className={allDone ? "text-emerald-600" : "text-gray-900"}>{signed}</span>
          <span className="text-gray-400"> of {total}</span>
          <span className="ml-1 text-gray-500">acknowledged</span>
        </p>
        <span className={`text-xs font-bold ${allDone ? "text-emerald-600" : pct >= 60 ? "text-amber-600" : "text-red-500"}`}>
          {pct}%
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${
            allDone ? "bg-emerald-500" : pct >= 60 ? "bg-amber-400" : "bg-red-400"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** Single row in the admin employee list */
function StaffAckRow({
  staffId,
  name,
  ack,
}: {
  staffId: string;
  name:    string;
  ack:     DocAcknowledgement | undefined;
}) {
  const signed = !!ack;
  const bg     = avatarHue(staffId);
  const fg     = avatarTextHue(staffId);

  return (
    <div className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-gray-50 transition-colors">
      {/* Avatar */}
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold"
        style={{ background: bg, color: fg }}
      >
        {getInitials(name)}
      </div>

      {/* Name + timestamp */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-gray-800">{name}</p>
        {signed && ack?.acknowledgedAt && (
          <p className="text-[10px] text-gray-400 leading-tight">{fmtDateTime(ack.acknowledgedAt)}</p>
        )}
      </div>

      {/* Badge */}
      {signed ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">
          <CheckCircle2 className="h-3 w-3" /> Signed
        </span>
      ) : (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600 ring-1 ring-red-200">
          <XCircle className="h-3 w-3" /> Pending
        </span>
      )}
    </div>
  );
}

/** Full admin acknowledgement panel */
function AdminAckPanel({
  ackInfo,
  loading,
}: {
  ackInfo:  AckInfo | null;
  loading:  boolean;
}) {
  // staffMap is already resolved by the parent — no extra fetch needed
  const staffMap = ackInfo?.staffMap ?? new Map<string, StaffRecord>();

  if (loading) {
    return (
      <div className="space-y-2 pt-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-2 py-2 animate-pulse">
            <div className="h-8 w-8 shrink-0 rounded-full bg-gray-100" />
            <div className="flex-1 space-y-1.5">
              <div className="h-2.5 w-32 rounded-full bg-gray-100" />
              <div className="h-2 w-20 rounded-full bg-gray-50" />
            </div>
            <div className="h-5 w-14 rounded-full bg-gray-100" />
          </div>
        ))}
      </div>
    );
  }

  if (!ackInfo) return null;

  const { acknowledgements, acknowledgedCount, totalStaff } = ackInfo;

  // Build ack lookup: staffId → acknowledgement
  const ackByStaff = new Map<string, DocAcknowledgement>();
  for (const a of acknowledgements) ackByStaff.set(a.staffId, a);

  // Build combined rows: all staff, signed first
  const allStaffIds = Array.from(staffMap.keys());

  // Staff who signed (in ack list)
  const signedIds   = acknowledgements.map((a) => a.staffId);
  // Staff who haven't signed (in staffMap but not in ackByStaff)
  const pendingIds  = allStaffIds.filter((id) => !ackByStaff.has(id));
  // Staff in ack list but not in staffMap (edge case — show with ID fallback)
  const unknownAcks = acknowledgements.filter((a) => !staffMap.has(a.staffId));

  const rows: Array<{ staffId: string; name: string; ack: DocAcknowledgement | undefined }> = [
    ...signedIds.map((id) => ({
      staffId: id,
      name:    staffMap.has(id)
        ? `${staffMap.get(id)!.firstName} ${staffMap.get(id)!.lastName}`
        : `Staff ${id.slice(-6)}`,
      ack: ackByStaff.get(id),
    })),
    ...unknownAcks
      .filter((a) => !signedIds.includes(a.staffId))
      .map((a) => ({ staffId: a.staffId, name: `Staff ${a.staffId.slice(-6)}`, ack: a })),
    ...pendingIds.map((id) => ({
      staffId: id,
      name:    `${staffMap.get(id)!.firstName} ${staffMap.get(id)!.lastName}`,
      ack:     undefined,
    })),
  ];

  const displayTotal = totalStaff > 0 ? totalStaff : rows.length;

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <AckProgressBar signed={acknowledgedCount} total={displayTotal} />

      {/* Employee list */}
      {rows.length === 0 ? (
        <p className="rounded-xl bg-gray-50 px-3 py-3 text-center text-xs text-gray-400">
          No acknowledgement records yet.
        </p>
      ) : (
        <div className="max-h-52 overflow-y-auto rounded-xl border border-gray-100 bg-white -mx-1 px-1">
          {rows.map((r) => (
            <StaffAckRow key={r.staffId} {...r} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Viewer content — file type detection
// ---------------------------------------------------------------------------

function DocumentPreview({ url, fileType }: { url: string; fileType: string }) {
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);

  const isImage = fileType.startsWith("image/");
  const isPDF   = fileType === "application/pdf" || url.toLowerCase().endsWith(".pdf");

  if (isImage) {
    return (
      <div className="flex h-full items-center justify-center overflow-auto p-4 bg-checkered">
        {loading && <Loader2 className="absolute h-8 w-8 animate-spin text-purple-400" />}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt="Document preview"
          className={cn("max-h-full max-w-full rounded-xl shadow-lg transition-opacity duration-300", loading ? "opacity-0" : "opacity-100")}
          onLoad={() => setLoading(false)}
          onError={() => { setLoading(false); setErrored(true); }}
        />
        {errored && <NoPreview url={url} />}
      </div>
    );
  }

  if (isPDF) {
    return (
      <div className="relative h-full w-full">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
            <div className="flex flex-col items-center gap-3 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
              <p className="text-sm font-medium text-gray-500">Loading PDF…</p>
            </div>
          </div>
        )}
        <iframe
          src={url}
          className="h-full w-full border-0"
          title="Document Preview"
          onLoad={() => setLoading(false)}
          onError={() => { setLoading(false); setErrored(true); }}
        />
        {errored && <NoPreview url={url} />}
      </div>
    );
  }

  return <NoPreview url={url} />;
}

function NoPreview({ url }: { url: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 p-8 text-center">
      <div
        className="flex h-20 w-20 items-center justify-center rounded-3xl shadow-xl shadow-purple-200/60"
        style={{ background: "linear-gradient(135deg, #d25cf6 0%, #5c64f6 100%)" }}
      >
        <FileText className="h-10 w-10 text-white" />
      </div>
      <div>
        <h3 className="text-base font-bold text-gray-900">Preview Not Available</h3>
        <p className="mt-1 text-sm text-gray-500">This file type cannot be previewed in the browser.</p>
      </div>
      <a
        href={url}
        download
        className="flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-purple-200 transition-all hover:-translate-y-0.5 hover:brightness-110"
        style={{ background: "linear-gradient(135deg, #d25cf6 0%, #5c64f6 100%)" }}
      >
        <Download className="h-4 w-4" /> Download File
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DocumentViewerModal({
  doc,
  isAdmin = false,
  onClose,
  onAcknowledged,
}: DocumentViewerModalProps) {
  const [showSignModal, setShowSignModal] = useState(false);
  const [ackInfo, setAckInfo]             = useState<AckInfo | null>(null);
  const [ackLoading, setAckLoading]       = useState(false);

  const cat = categoryConfig[doc.category] ?? categoryConfig.OTHER;

  // Fetch ack status + total staff in parallel when modal opens
  useEffect(() => {
    setAckLoading(true);

    const ackPromise   = getAckStatus(doc.id);
    const staffPromise = isAdmin ? fetchStaffMap() : Promise.resolve(new Map<string, StaffRecord>());

    Promise.all([ackPromise, staffPromise])
      .then(([res, staffMap]) => {
        const acks = res.data.acknowledgements;
        setAckInfo({
          acknowledged:      acks.length > 0,
          acknowledgedAt:    acks[0]?.acknowledgedAt,
          acknowledgedCount: res.data.acknowledgedCount,
          acknowledgements:  acks,
          totalStaff:        staffMap.size,
          staffMap,
        });
      })
      .catch(() => {
        setAckInfo({
          acknowledged:      doc.acknowledged ?? false,
          acknowledgedCount: 0,
          acknowledgements:  [],
          totalStaff:        0,
          staffMap:          new Map(),
        });
      })
      .finally(() => setAckLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id, doc.acknowledged, isAdmin]);

  function handleAcknowledged(docId: string) {
    setAckInfo((prev) => prev
      ? {
          ...prev,
          acknowledged:      true,
          acknowledgedAt:    new Date().toISOString(),
          acknowledgedCount: prev.acknowledgedCount + 1,
        }
      : {
          acknowledged:      true,
          acknowledgedAt:    new Date().toISOString(),
          acknowledgedCount: 1,
          acknowledgements:  [],
          totalStaff:        0,
          staffMap:          new Map(),
        }
    );
    onAcknowledged?.(docId);
    toast.success("Document acknowledged!", "Your digital signature has been recorded.");
  }

  const userHasAcked = ackInfo?.acknowledged ?? doc.acknowledged ?? false;
  const needsUserAck = doc.requiresAck && !isAdmin && !userHasAcked && doc.status === "ACTIVE";

  return (
    <>
      {/* ── Modal backdrop ── */}
      <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

        {/* ── Modal ── */}
        <div className="relative flex h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl shadow-black/20 sm:h-[90vh] sm:rounded-3xl">

          {/* ── Header ── */}
          <div
            className="relative flex shrink-0 items-center gap-4 px-6 py-4"
            style={{ background: "linear-gradient(135deg, #d25cf6 0%, #5c64f6 100%)" }}
          >
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />

            {/* Category icon */}
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20 ring-1 ring-white/30 shadow-lg">
              <span className="text-white">{cat.icon}</span>
            </div>

            <div className="relative flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/90">
                  {cat.label}
                </span>
                <StatusBadge
                  status={needsUserAck ? "PENDING_ACK" : userHasAcked ? "ACKNOWLEDGED" : doc.status}
                  size="sm"
                />
              </div>
              <h2 className="mt-1 line-clamp-1 text-base font-extrabold text-white">{doc.title}</h2>
            </div>

            {/* Actions */}
            <div className="relative flex shrink-0 items-center gap-2">
              <a
                href={doc.fileUrl}
                download
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 text-white ring-1 ring-white/30 transition-all hover:bg-white/30 active:scale-95"
                title="Download"
              >
                <Download className="h-4 w-4" />
              </a>
              <a
                href={doc.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 text-white ring-1 ring-white/30 transition-all hover:bg-white/30 active:scale-95"
                title="Open in new tab"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 text-white ring-1 ring-white/30 transition-all hover:bg-white/30 active:scale-95"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* ── Main layout: preview + sidebar ── */}
          <div className="flex flex-1 overflow-hidden">

            {/* Document preview */}
            <div className="flex-1 overflow-hidden bg-gray-50">
              <DocumentPreview url={doc.fileUrl} fileType={doc.fileType} />
            </div>

            {/* ── Sidebar ── */}
            <div className="flex w-72 shrink-0 flex-col gap-0 overflow-y-auto border-l border-gray-100 bg-white">

              {/* Document meta */}
              <div className="space-y-4 p-5">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Document Info</h3>

                <div className="space-y-3">
                  {/* Title */}
                  <div>
                    <p className="text-[10px] font-bold uppercase text-gray-400">Title</p>
                    <p className="mt-0.5 text-sm font-semibold text-gray-900 leading-snug">{doc.title}</p>
                  </div>

                  {doc.description && (
                    <div>
                      <p className="text-[10px] font-bold uppercase text-gray-400">Description</p>
                      <p className="mt-0.5 text-xs text-gray-600 leading-relaxed">{doc.description}</p>
                    </div>
                  )}

                  {/* Meta pills */}
                  <div className="flex flex-wrap gap-1.5">
                    <span className="flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-1 text-[10px] font-bold text-purple-700">
                      <GitBranch className="h-2.5 w-2.5" /> v{doc.version}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-semibold uppercase text-gray-500">
                      {doc.fileType.split("/")[1] ?? doc.fileType}
                    </span>
                    <span className="rounded-full bg-gray-50 px-2.5 py-1 text-[10px] text-gray-400">
                      {fmtSize(doc.fileSize)}
                    </span>
                  </div>

                  <ExpiryChip expiresAt={doc.expiresAt} />

                  {/* Access level */}
                  <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2.5">
                    <Users className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                    <div>
                      <p className="text-[10px] font-bold uppercase text-gray-400">Access</p>
                      <p className="text-xs font-semibold text-gray-700">
                        {doc.accessLevel === "ALL" ? "All Staff" : doc.accessLevel.replace("_", " ")}
                      </p>
                    </div>
                  </div>

                  {/* Uploaded */}
                  <div>
                    <p className="text-[10px] font-bold uppercase text-gray-400">Uploaded</p>
                    <p className="mt-0.5 text-xs text-gray-600">{fmtDate(doc.createdAt)}</p>
                  </div>

                  {/* Tags */}
                  {doc.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {doc.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-600">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="mx-5 border-t border-gray-100" />

              {/* ── Acknowledgement Status section ── */}
              <div className="flex-1 p-5">
                <div className="mb-3 flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-gray-400" />
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    Acknowledgement Status
                  </h3>
                </div>

                {!doc.requiresAck ? (
                  /* ── No ack required ── */
                  <div className="flex flex-col items-center gap-2 rounded-2xl bg-gray-50 px-4 py-5 text-center">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100">
                      <ShieldCheck className="h-4 w-4 text-gray-400" />
                    </div>
                    <p className="text-xs font-medium text-gray-500 leading-relaxed">
                      No acknowledgement required for this document.
                    </p>
                  </div>

                ) : isAdmin ? (
                  /* ── Admin: full list view ── */
                  <div className="space-y-3">
                    {/* My own status (admin signed?) */}
                    {ackLoading ? (
                      <div className="h-10 animate-pulse rounded-xl bg-gray-50" />
                    ) : userHasAcked ? (
                      <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                        <div>
                          <p className="text-xs font-bold text-emerald-700">You have acknowledged</p>
                          {ackInfo?.acknowledgedAt && (
                            <p className="text-[10px] text-emerald-600">{fmtDate(ackInfo.acknowledgedAt)}</p>
                          )}
                        </div>
                      </div>
                    ) : null}

                    {/* Full staff list with progress */}
                    <AdminAckPanel ackInfo={ackInfo} loading={ackLoading} />
                  </div>

                ) : (
                  /* ── Employee: own status only ── */
                  <div className="space-y-3">
                    {ackLoading ? (
                      <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-3">
                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                        <p className="text-xs text-gray-500">Checking status…</p>
                      </div>
                    ) : userHasAcked ? (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                          <p className="text-sm font-bold text-emerald-700">You acknowledged this document</p>
                        </div>
                        {ackInfo?.acknowledgedAt && (
                          <p className="mt-1.5 text-xs text-emerald-600">
                            Signed on {fmtDate(ackInfo.acknowledgedAt)}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-orange-600" />
                          <p className="text-sm font-bold text-orange-700">Acknowledgement Required</p>
                        </div>
                        <p className="mt-1.5 text-xs text-orange-600">
                          Please read the document and sign your acknowledgement.
                        </p>
                      </div>
                    )}

                    {/* Sign button */}
                    {!userHasAcked && doc.status === "ACTIVE" && (
                      <button
                        onClick={() => setShowSignModal(true)}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-white shadow-lg shadow-purple-200 transition-all duration-300 hover:-translate-y-0.5 hover:brightness-110 hover:shadow-xl active:scale-95"
                        style={{ background: "linear-gradient(135deg, #d25cf6 0%, #5c64f6 100%)" }}
                      >
                        <ShieldCheck className="h-4 w-4" />
                        Acknowledge & Sign
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Signature modal (rendered above viewer) ── */}
      {showSignModal && (
        <SignatureModal
          doc={doc}
          onClose={() => setShowSignModal(false)}
          onAcknowledged={handleAcknowledged}
        />
      )}
    </>
  );
}
