"use client";

import { useState } from "react";
import {
  Shield, FileText, BookOpen, ClipboardList, ListOrdered,
  CheckSquare, File, Download, Eye, CheckCircle2, Clock,
  GitBranch, AlertTriangle, MoreVertical, Archive,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { HrDocument, DocumentCategory, DocumentStatus } from "@/types/vault";
import { StatusBadge }          from "./StatusBadge";
import { DocumentViewerModal }  from "./DocumentViewerModal";
import { acknowledgeDocument, updateDocumentStatus } from "@/lib/vault-api";
import { toast } from "@/components/ui/Toaster";

// ---------------------------------------------------------------------------
// Category config
// ---------------------------------------------------------------------------

const categoryConfig: Record<DocumentCategory, { icon: React.ReactNode; color: string; bg: string }> = {
  POLICY:     { icon: <Shield className="h-4 w-4" />,       color: "text-purple-600", bg: "bg-purple-50" },
  CONTRACT:   { icon: <FileText className="h-4 w-4" />,     color: "text-blue-600",   bg: "bg-blue-50" },
  HANDBOOK:   { icon: <BookOpen className="h-4 w-4" />,     color: "text-indigo-600", bg: "bg-indigo-50" },
  FORM:       { icon: <ClipboardList className="h-4 w-4" />,color: "text-cyan-600",   bg: "bg-cyan-50" },
  SOP:        { icon: <ListOrdered className="h-4 w-4" />,  color: "text-teal-600",   bg: "bg-teal-50" },
  COMPLIANCE: { icon: <CheckSquare className="h-4 w-4" />,  color: "text-green-600",  bg: "bg-green-50" },
  OTHER:      { icon: <File className="h-4 w-4" />,         color: "text-gray-600",   bg: "bg-gray-50" },
};

// ---------------------------------------------------------------------------
// Expiry indicator — driven by warningLevel + status
// ---------------------------------------------------------------------------

type WarningLevel = "none" | "low" | "medium" | "high";

function ExpiryIndicator({
  expiresAt, warningLevel, status,
}: {
  expiresAt:    string | null;
  warningLevel: WarningLevel;
  status:       DocumentStatus;
}) {
  if (!expiresAt) return null;

  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);

  if (status === "EXPIRED" || days < 0) return (
    <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
      <AlertTriangle className="h-3 w-3" /> Expired
    </span>
  );

  if (warningLevel === "high") return (
    <span
      title={`Expires in ${days} day${days !== 1 ? "s" : ""} — immediate attention required`}
      className="flex animate-pulse items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600 ring-1 ring-red-200"
    >
      <AlertTriangle className="h-3 w-3" /> {days}d left
    </span>
  );

  if (warningLevel === "medium") return (
    <span
      title={`Expires in ${days} days`}
      className="flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-600"
    >
      <Clock className="h-3 w-3" /> {days}d left
    </span>
  );

  if (warningLevel === "low") return (
    <span
      title={`Expires in ${days} days`}
      className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600"
    >
      <Clock className="h-3 w-3" /> {days}d left
    </span>
  );

  // Safe / no warning
  return (
    <span
      title={`Expires ${new Date(expiresAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`}
      className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-600"
    >
      <Clock className="h-3 w-3" />{" "}
      {new Date(expiresAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
    </span>
  );
}

function accentForDoc(status: DocumentStatus, warningLevel: WarningLevel): string {
  if (status === "EXPIRED")         return "border-l-red-500";
  if (status === "ARCHIVED")        return "border-l-gray-300";
  if (warningLevel === "high")      return "border-l-red-500";
  if (warningLevel === "medium")    return "border-l-orange-400";
  if (warningLevel === "low")       return "border-l-amber-400";
  return "border-l-green-500";
}

function fmtSize(bytes: number) {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024)     return `${(bytes / 1_024).toFixed(0)} KB`;
  return `${bytes} B`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DocumentCardProps {
  doc:             HrDocument;
  showAckButton?:  boolean;
  onAcknowledged?: (docId: string) => void;
  onArchived?:     (docId: string) => void;
  isAdmin?:        boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DocumentCard({
  doc,
  showAckButton = false,
  onAcknowledged,
  onArchived,
  isAdmin = false,
}: DocumentCardProps) {
  const [acked, setAcked]           = useState(doc.acknowledged ?? false);
  const [menuOpen, setMenuOpen]     = useState(false);
  const [archiving, setArchiving]   = useState(false);
  const [showViewer, setShowViewer] = useState(false);

  const cat    = categoryConfig[doc.category] ?? categoryConfig.OTHER;
  const accent = accentForDoc(doc.status, doc.warningLevel ?? "none");
  const needsAck = doc.requiresAck && !acked && doc.status === "ACTIVE";
  const isCritical = doc.warningLevel === "high" && doc.status === "ACTIVE";

  async function handleArchive() {
    setArchiving(true);
    try {
      await updateDocumentStatus(doc.id, "ARCHIVED");
      toast.success("Document archived", `"${doc.title}" has been archived.`);
      onArchived?.(doc.id);
    } catch (err) {
      toast.error("Archive failed", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setArchiving(false);
      setMenuOpen(false);
    }
  }

  function handleAcknowledged(docId: string) {
    setAcked(true);
    onAcknowledged?.(docId);
  }

  return (
    <>
      <div
        className={cn(
          "group relative flex flex-col rounded-2xl border border-l-4 border-gray-100 bg-white shadow-md",
          "transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-purple-100/60",
          accent,
          // Subtle red glow for documents expiring within 7 days
          isCritical && "shadow-red-100/80 ring-1 ring-red-100"
        )}
      >
        {/* ── Top ── */}
        <div className="p-5 pb-3">
          <div className="flex items-start justify-between gap-3">
            {/* Category icon */}
            <div className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm",
              cat.bg, cat.color
            )}>
              {cat.icon}
            </div>

            {/* Badges */}
            <div className="flex flex-1 flex-wrap items-center justify-end gap-1.5">
              <StatusBadge
                status={needsAck ? "PENDING_ACK" : acked ? "ACKNOWLEDGED" : doc.status}
                size="sm"
              />
            </div>

            {/* Admin context menu */}
            {isAdmin && (
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
                  className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-700"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-8 z-20 w-36 rounded-xl border border-gray-100 bg-white py-1 shadow-xl">
                    <button
                      onClick={handleArchive}
                      disabled={archiving}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    >
                      <Archive className="h-3.5 w-3.5" />
                      {archiving ? "Archiving…" : "Archive"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Title */}
          <h3 className="mt-3 line-clamp-2 text-sm font-bold text-gray-900 leading-snug">
            {doc.title}
          </h3>
          {doc.description && (
            <p className="mt-1 line-clamp-2 text-xs text-gray-500 leading-relaxed">
              {doc.description}
            </p>
          )}
        </div>

        {/* ── Meta row ── */}
        <div className="mx-5 flex flex-wrap items-center gap-2 border-t border-gray-50 py-3">
          <span className="flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-600">
            <GitBranch className="h-3 w-3" /> v{doc.version}
          </span>
          <span className="rounded-full bg-gray-50 px-2 py-0.5 text-[10px] font-medium uppercase text-gray-500">
            {doc.fileType.split("/")[1] ?? doc.fileType}
          </span>
          <span className="text-[10px] text-gray-400">{fmtSize(doc.fileSize)}</span>
          <ExpiryIndicator
            expiresAt={doc.expiresAt}
            warningLevel={doc.warningLevel ?? "none"}
            status={doc.status}
          />
        </div>

        {/* ── Actions ── */}
        <div className="flex items-center gap-2 border-t border-gray-50 px-5 py-3">

          {/* Open viewer */}
          <button
            onClick={() => setShowViewer(true)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white py-2 text-xs font-semibold text-gray-700 transition-all hover:border-purple-200 hover:bg-purple-50 hover:text-purple-700"
          >
            <Eye className="h-3.5 w-3.5" /> View
          </button>

          {/* Download */}
          <a
            href={doc.fileUrl}
            download
            onClick={(e) => e.stopPropagation()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white py-2 text-xs font-semibold text-gray-700 transition-all hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          >
            <Download className="h-3.5 w-3.5" /> Download
          </a>

          {/* Acknowledge button (employee, requires ack, not yet signed) */}
          {showAckButton && doc.requiresAck && (
            <button
              onClick={() => setShowViewer(true)}
              disabled={acked}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-all",
                acked
                  ? "cursor-default bg-green-50 text-green-600"
                  : "bg-gradient-to-r from-purple-600 to-violet-600 text-white shadow-sm shadow-purple-200 hover:brightness-110 active:scale-95"
              )}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {acked ? "Signed" : "Sign"}
            </button>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="rounded-b-2xl bg-gray-50/60 px-5 py-2 text-[10px] text-gray-400">
          Uploaded{" "}
          {new Date(doc.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
          {doc.accessLevel !== "ALL" && (
            <span className="ml-2 rounded-full bg-gray-100 px-1.5 py-0.5 font-medium text-gray-500">
              {doc.accessLevel.replace("_", " ")}
            </span>
          )}
        </div>
      </div>

      {/* ── Document viewer modal ── */}
      {showViewer && (
        <DocumentViewerModal
          doc={{ ...doc, acknowledged: acked }}
          isAdmin={isAdmin}
          onClose={() => setShowViewer(false)}
          onAcknowledged={handleAcknowledged}
        />
      )}
    </>
  );
}
