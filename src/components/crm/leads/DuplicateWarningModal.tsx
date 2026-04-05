"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Phone,
  Mail,
  Building2,
  User,
  ExternalLink,
  GitMerge,
  Plus,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import type { DuplicateMatch } from "@/modules/crm/services/duplicate.service";

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  open:            boolean;
  matches:         DuplicateMatch[];
  onClose:         () => void;
  /** Called when the user picks "Create anyway" — passes the duplicate IDs for audit. */
  onForceCreate:   (duplicateIds: string[]) => void;
  /** Called when the user picks "Merge" with a target lead selected. */
  onMerge?:        (targetId: string) => void;
}

// ─── Confidence badge ─────────────────────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: "HIGH" | "MEDIUM" }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
        confidence === "HIGH"
          ? "bg-red-100 text-red-700"
          : "bg-amber-100 text-amber-700",
      )}
    >
      {confidence === "HIGH" ? "High match" : "Possible match"}
    </span>
  );
}

// ─── Stage badge ──────────────────────────────────────────────────────────────

const STAGE_COLORS: Record<string, string> = {
  NEW:       "bg-gray-100 text-gray-600",
  CONTACTED: "bg-blue-50 text-blue-700",
  QUALIFIED: "bg-indigo-50 text-indigo-700",
  PROPOSAL:  "bg-violet-50 text-violet-700",
  WON:       "bg-green-50 text-green-700",
  LOST:      "bg-red-50 text-red-700",
};

function StageBadge({ stage }: { stage: string }) {
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", STAGE_COLORS[stage] ?? "bg-gray-100 text-gray-600")}>
      {stage.charAt(0) + stage.slice(1).toLowerCase()}
    </span>
  );
}

// ─── Match card ───────────────────────────────────────────────────────────────

function MatchCard({
  match,
  selected,
  onSelect,
}: {
  match:    DuplicateMatch;
  selected: boolean;
  onSelect: () => void;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-xl border-2 p-4 text-left transition-all",
        selected
          ? "border-indigo-500 bg-indigo-50 shadow-sm"
          : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm",
      )}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-indigo-200 text-[11px] font-bold text-indigo-700">
            {(match.firstName[0] ?? "") + (match.lastName[0] ?? "")}
          </div>
          <div>
            <p className="font-semibold text-gray-900">
              {match.firstName} {match.lastName}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <ConfidenceBadge confidence={match.confidence} />
          <StageBadge stage={match.stage} />
        </div>
      </div>

      {/* Details */}
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-gray-500">
        <span className="flex items-center gap-1.5 truncate">
          <Mail className="h-3 w-3 shrink-0 text-gray-400" />
          {match.email}
        </span>
        {match.phone && (
          <span className="flex items-center gap-1.5 truncate">
            <Phone className="h-3 w-3 shrink-0 text-gray-400" />
            {match.phone}
          </span>
        )}
        {match.company && (
          <span className="flex items-center gap-1.5 truncate">
            <Building2 className="h-3 w-3 shrink-0 text-gray-400" />
            {match.company}
          </span>
        )}
      </div>

      {/* Why flagged */}
      <div className="mt-2 flex flex-wrap gap-1">
        {match.reasons.map((r) => (
          <span key={r} className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
            {r}
          </span>
        ))}
      </div>

      {/* View link — stopPropagation so it doesn't toggle selection */}
      <div
        className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-indigo-600"
        onClick={(e) => { e.stopPropagation(); router.push(`/crm/leads/${match.id}`); }}
      >
        <ExternalLink className="h-3 w-3" />
        View existing lead
      </div>
    </button>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function DuplicateWarningModal({
  open,
  matches,
  onClose,
  onForceCreate,
  onMerge,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [merging,    setMerging]    = useState(false);
  const [mergeError, setMergeError] = useState("");

  const highCount   = matches.filter((m) => m.confidence === "HIGH").length;
  const mediumCount = matches.filter((m) => m.confidence === "MEDIUM").length;

  function handleForceCreate() {
    onForceCreate(matches.map((m) => m.id));
  }

  async function handleMerge() {
    if (!selectedId || !onMerge) return;
    setMerging(true);
    setMergeError("");
    try {
      onMerge(selectedId);
    } catch {
      setMergeError("Merge failed. Please try again.");
    } finally {
      setMerging(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title=""
      size="lg"
    >
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">
              Possible duplicate{matches.length > 1 ? "s" : ""} found
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">
              {highCount > 0 && (
                <span className="font-semibold text-red-600">{highCount} high-confidence match{highCount > 1 ? "es" : ""}</span>
              )}
              {highCount > 0 && mediumCount > 0 && " and "}
              {mediumCount > 0 && (
                <span className="font-semibold text-amber-600">{mediumCount} possible match{mediumCount > 1 ? "es" : ""}</span>
              )}
              {" "}already exist{matches.length === 1 ? "s" : ""} in the system.
            </p>
          </div>
        </div>

        {/* Match cards */}
        <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
          {matches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              selected={selectedId === match.id}
              onSelect={() => setSelectedId((prev) => prev === match.id ? null : match.id)}
            />
          ))}
        </div>

        {/* Merge hint */}
        {onMerge && (
          <p className="text-xs text-gray-500">
            <strong>Select a lead above</strong> to merge your new data into it, or choose an action below.
          </p>
        )}

        {mergeError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{mergeError}</p>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 pt-4">
          {/* Cancel */}
          <Button type="button" variant="secondary" onClick={onClose}>
            <X className="h-4 w-4" />
            Cancel
          </Button>

          {/* Create anyway */}
          <button
            type="button"
            onClick={handleForceCreate}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50"
          >
            <Plus className="h-4 w-4" />
            Create anyway
          </button>

          {/* Merge (only shown when a merge target is selected) */}
          {onMerge && (
            <button
              type="button"
              disabled={!selectedId || merging}
              onClick={handleMerge}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition-all",
                selectedId
                  ? "bg-indigo-600 text-white hover:bg-indigo-700"
                  : "cursor-not-allowed bg-gray-100 text-gray-400",
              )}
            >
              <GitMerge className="h-4 w-4" />
              {merging ? "Merging…" : "Merge into selected"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
