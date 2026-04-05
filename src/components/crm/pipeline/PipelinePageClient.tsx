"use client";

import { useRouter, usePathname } from "next/navigation";
import dynamic from "next/dynamic";

// ssr: false — dnd-kit generates unique aria-describedby / aria-roledescription
// IDs at runtime. If the board is server-rendered those IDs won't match the
// client render, causing a React hydration mismatch. Skipping SSR entirely
// means the board is always first-painted client-side — no mismatch possible.
const DynamicPipelineBoard = dynamic(
  () => import("./DynamicPipelineBoard").then((m) => m.DynamicPipelineBoard),
  { ssr: false }
);
import { Button } from "@/components/ui/Button";
import { Layers, AlertCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import type { KanbanView, PipelineTemplate } from "@/modules/crm/types";

interface PipelinePageClientProps {
  templates: PipelineTemplate[];
  selectedTemplate: PipelineTemplate | null;
  kanban: KanbanView | null;
  /** ID currently shown (from URL param) */
  templateId: string | null;
}

export function PipelinePageClient({
  templates,
  selectedTemplate,
  kanban,
  templateId,
}: PipelinePageClientProps) {
  const router   = useRouter();
  const pathname = usePathname();

  const [seeding,    setSeeding]    = useState(false);
  const [migrating,  setMigrating]  = useState(false);
  const [seedMsg,    setSeedMsg]    = useState<string | null>(null);

  // ── No templates at all ────────────────────────────────────────────────────
  if (templates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-slate-200 py-24 text-center">
        <Layers className="h-10 w-10 text-slate-300" />
        <div>
          <p className="text-lg font-semibold text-slate-700">No pipeline templates</p>
          <p className="mt-1 text-sm text-slate-400">
            Seed the default Product, Service, and AMC templates to get started.
          </p>
        </div>
        {seedMsg && (
          <p className="rounded-lg bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
            {seedMsg}
          </p>
        )}
        <Button
          icon={seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
          disabled={seeding}
          onClick={async () => {
            setSeeding(true);
            setSeedMsg(null);
            try {
              const res = await fetch("/api/crm/pipeline/seed", { method: "POST" });
              const json = await res.json();
              setSeedMsg(`Created: ${json.created.join(", ") || "none"}`);
              router.refresh();
            } catch {
              setSeedMsg("Seed failed — check console");
            } finally {
              setSeeding(false);
            }
          }}
        >
          {seeding ? "Seeding…" : "Seed Default Templates"}
        </Button>
      </div>
    );
  }

  function selectTemplate(id: string) {
    router.push(`${pathname}?template=${id}`);
  }

  const totalLeads = kanban?.columns.reduce((s, c) => s + c.count, 0) ?? 0;
  const totalValue = kanban?.totalPipelineValue ?? 0;

  return (
    <div className="flex flex-col gap-4">

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Template selector */}
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <Layers className="h-4 w-4 text-slate-400 shrink-0" />
          <label htmlFor="template-select" className="sr-only">Pipeline type</label>
          <select
            id="template-select"
            value={templateId ?? ""}
            onChange={(e) => selectTemplate(e.target.value)}
            className="bg-transparent text-sm font-semibold text-slate-700 focus:outline-none cursor-pointer"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {/* Summary pills */}
        {kanban && (
          <>
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-1.5 text-xs">
              <span className="font-semibold text-slate-700">{totalLeads}</span>
              <span className="ml-1 text-slate-400">leads</span>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-1.5 text-xs">
              <span className="font-semibold text-slate-700">{formatCurrency(totalValue)}</span>
              <span className="ml-1 text-slate-400">pipeline</span>
            </div>
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs">
              <span className="font-semibold text-emerald-700">
                {formatCurrency(kanban.forecastedValue)}
              </span>
              <span className="ml-1 text-emerald-500">forecasted</span>
            </div>
          </>
        )}

        {/* Migrate button — useful after seed */}
        <div className="ml-auto">
          <Button
            variant="secondary"
            size="sm"
            icon={migrating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : undefined}
            disabled={migrating}
            onClick={async () => {
              setMigrating(true);
              try {
                const res  = await fetch("/api/crm/pipeline/migrate-leads", { method: "POST" });
                const json = await res.json();
                if (!res.ok) throw new Error(json.error);
                setSeedMsg(`Migrated ${json.migrated} lead${json.migrated !== 1 ? "s" : ""} → ${json.template}`);
                router.refresh();
              } catch (err) {
                setSeedMsg(err instanceof Error ? err.message : "Migration failed");
              } finally {
                setMigrating(false);
              }
            }}
          >
            {migrating ? "Migrating…" : "Migrate Leads"}
          </Button>
        </div>
      </div>

      {/* Inline feedback */}
      {seedMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {seedMsg}
        </div>
      )}

      {/* ── Board ───────────────────────────────────────────────────────── */}
      {kanban ? (
        <DynamicPipelineBoard initialData={kanban} />
      ) : (
        <div className="flex items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-24 text-sm text-slate-400">
          Select a pipeline template above to view the board.
        </div>
      )}
    </div>
  );
}
