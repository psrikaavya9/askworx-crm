"use client";

import { useState, useCallback } from "react";
import {
  Database,
  Filter,
  Play,
  Save,
  Download,
  Trash2,
  ChevronRight,
  CheckCircle2,
  Clock,
  RotateCcw,
} from "lucide-react";
import { BUILDER_MODULES, BUILDER_MODULES_BY_CATEGORY, BUILDER_MODULES_BY_ID } from "@/lib/builder-config";
import type {
  BuilderModuleId,
  FilterCondition,
  BuilderResult,
  SavedReportRecord,
} from "@/modules/reports/types/builder";
import { FieldSelector } from "@/components/reports/builder/FieldSelector";
import { FilterBuilder } from "@/components/reports/builder/FilterBuilder";
import { SaveReportModal } from "@/components/reports/builder/SaveReportModal";

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

const STEPS = ["Module", "Fields", "Filters", "Results"] as const;
type Step = 0 | 1 | 2 | 3;

function StepBar({ current }: { current: Step }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors ${
                  done
                    ? "bg-indigo-600 border-blue-600 text-white"
                    : active
                    ? "border-blue-600 text-indigo-600 bg-white"
                    : "border-gray-300 text-gray-400 bg-white"
                }`}
              >
                {done ? <CheckCircle2 size={16} /> : i + 1}
              </div>
              <span
                className={`mt-1 text-xs font-medium ${
                  active ? "text-indigo-600" : done ? "text-blue-500" : "text-gray-400"
                }`}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`h-0.5 w-16 mx-2 mb-5 transition-colors ${
                  done ? "bg-indigo-600" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

function exportCSV(result: BuilderResult) {
  const header = result.columns.map((c) => `"${c.label}"`).join(",");
  const rows = result.data.map((row) =>
    result.columns
      .map((c) => {
        const v = row[c.key];
        if (v === null || v === undefined) return "";
        const s = String(v).replace(/"/g, '""');
        return `"${s}"`;
      })
      .join(",")
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `report-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ReportBuilderPage() {
  const [step, setStep] = useState<Step>(0);
  const [moduleId, setModuleId] = useState<BuilderModuleId | null>(null);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [result, setResult] = useState<BuilderResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSave, setShowSave] = useState(false);
  const [savedReports, setSavedReports] = useState<SavedReportRecord[] | null>(null);
  const [loadingReports, setLoadingReports] = useState(false);

  const moduleDef = moduleId ? BUILDER_MODULES_BY_ID[moduleId] : null;
  const categories = Object.entries(BUILDER_MODULES_BY_CATEGORY);

  // Step 1 → 2: choose module
  function selectModule(id: BuilderModuleId) {
    if (moduleId !== id) {
      setSelectedFields([]);
      setFilters([]);
      setResult(null);
    }
    setModuleId(id);
    setStep(1);
  }

  // Step 2 → 3
  function goToFilters() {
    if (!moduleDef) return;
    if (selectedFields.length === 0) {
      setSelectedFields(moduleDef.fields.map((f) => f.key));
    }
    setStep(2);
  }

  // Step 3 → Run
  async function runReport() {
    if (!moduleId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/reports/builder/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: moduleId, selectedFields, filters }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data: BuilderResult = await res.json();
      setResult(data);
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  // Save report
  async function handleSave(name: string) {
    if (!moduleId) return;
    const res = await fetch("/api/reports/builder/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, module: moduleId, selectedFields, filters }),
    });
    if (!res.ok) throw new Error("Save failed");
  }

  // Load saved reports
  async function loadSavedReports() {
    setLoadingReports(true);
    try {
      const res = await fetch("/api/reports/builder/saved");
      const data: SavedReportRecord[] = await res.json();
      setSavedReports(data);
    } finally {
      setLoadingReports(false);
    }
  }

  // Run saved report
  async function runSaved(id: string) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/reports/builder/run/${id}`);
      if (!res.ok) throw new Error(await res.text());
      const data: BuilderResult = await res.json();
      setModuleId(data.module);
      setResult(data);
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  // Delete saved report
  async function deleteSaved(id: string) {
    await fetch(`/api/reports/builder/run/${id}`, { method: "DELETE" });
    setSavedReports((prev) => prev?.filter((r) => r.id !== id) ?? null);
  }

  // Reset wizard
  function reset() {
    setStep(0);
    setModuleId(null);
    setSelectedFields([]);
    setFilters([]);
    setResult(null);
    setError("");
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Report Builder</h1>
          <p className="text-sm text-gray-500 mt-1">
            Build custom reports by selecting a module, fields, and filters.
          </p>
        </div>
        <button
          onClick={async () => {
            if (!savedReports) await loadSavedReports();
            setSavedReports((prev) => prev ?? []);
          }}
          className="flex items-center gap-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-sm"
        >
          <Clock size={15} />
          Saved Reports
        </button>
      </div>

      {/* Saved reports panel */}
      {savedReports !== null && (
        <div className="mb-6 border border-gray-200 rounded-xl bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-800">Saved Reports</h2>
            <button
              onClick={() => setSavedReports(null)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Close
            </button>
          </div>
          {loadingReports ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : savedReports.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No saved reports yet.</p>
          ) : (
            <div className="space-y-2">
              {savedReports.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg border border-gray-100 hover:border-gray-200 bg-gray-50"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{r.name}</p>
                    <p className="text-xs text-gray-400">
                      {r.module} · {r.executionCount} runs
                      {r.lastRun ? ` · Last: ${new Date(r.lastRun).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => runSaved(r.id)}
                      className="text-xs font-medium text-indigo-600 hover:text-blue-700 px-3 py-1 bg-blue-50 rounded-md"
                    >
                      Run
                    </button>
                    <button
                      onClick={() => deleteSaved(r.id)}
                      className="p-1 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Wizard card */}
      <div className="border border-gray-200 rounded-xl bg-white p-6">
        <StepBar current={step} />

        {/* Step 0 — Module */}
        {step === 0 && (
          <div>
            <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Database size={18} className="text-indigo-600" />
              Select a Module
            </h2>
            <div className="space-y-5">
              {categories.map(([category, mods]) => (
                <div key={category}>
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
                    {category}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {mods.map((mod) => (
                      <button
                        key={mod.id}
                        onClick={() => selectModule(mod.id)}
                        className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all hover:border-indigo-400 hover:shadow-sm ${
                          moduleId === mod.id
                            ? "border-indigo-500 bg-indigo-50"
                            : "border-gray-200 bg-white"
                        }`}
                      >
                        <Database
                          size={20}
                          className={moduleId === mod.id ? "text-indigo-600" : "text-gray-400"}
                        />
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{mod.label}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{mod.description}</p>
                        </div>
                        <ChevronRight size={16} className="ml-auto text-gray-300" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 1 — Fields */}
        {step === 1 && moduleDef && (
          <div>
            <h2 className="text-base font-semibold text-gray-800 mb-1 flex items-center gap-2">
              <Database size={18} className="text-indigo-600" />
              Select Fields
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Module: <span className="font-medium text-gray-700">{moduleDef.label}</span>
              <button
                onClick={() => setStep(0)}
                className="ml-2 text-indigo-600 hover:underline text-xs"
              >
                Change
              </button>
            </p>
            <FieldSelector
              fields={moduleDef.fields}
              selected={selectedFields.length > 0 ? selectedFields : moduleDef.fields.map((f) => f.key)}
              onChange={setSelectedFields}
            />
            <div className="flex justify-end mt-6">
              <button
                onClick={goToFilters}
                className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                Next: Filters
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — Filters */}
        {step === 2 && moduleDef && (
          <div>
            <h2 className="text-base font-semibold text-gray-800 mb-1 flex items-center gap-2">
              <Filter size={18} className="text-indigo-600" />
              Add Filters
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Module: <span className="font-medium text-gray-700">{moduleDef.label}</span> ·{" "}
              {selectedFields.length || moduleDef.fields.length} fields selected
            </p>
            <FilterBuilder
              fields={moduleDef.fields}
              filters={filters}
              onChange={setFilters}
            />
            {error && (
              <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <div className="flex items-center justify-between mt-6">
              <button
                onClick={() => setStep(1)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ← Back
              </button>
              <button
                onClick={runReport}
                disabled={loading}
                className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
              >
                <Play size={15} />
                {loading ? "Generating…" : "Generate Report"}
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Results */}
        {step === 3 && result && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-gray-800">Results</h2>
                <p className="text-sm text-gray-500">
                  {result.total} record{result.total !== 1 ? "s" : ""}
                  {result.truncated && " (truncated to 1 000)"}
                  {" · "}Generated {new Date(result.generatedAt).toLocaleTimeString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={reset}
                  className="flex items-center gap-1.5 text-sm text-gray-500 border border-gray-300 rounded-lg px-3 py-2 hover:bg-gray-50"
                >
                  <RotateCcw size={14} />
                  New Report
                </button>
                <button
                  onClick={() => setShowSave(true)}
                  className="flex items-center gap-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg px-3 py-2 hover:bg-gray-50"
                >
                  <Save size={14} />
                  Save
                </button>
                <button
                  onClick={() => exportCSV(result)}
                  className="flex items-center gap-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg px-3 py-2 hover:bg-indigo-700"
                >
                  <Download size={14} />
                  Export CSV
                </button>
              </div>
            </div>

            {result.data.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Database size={32} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">No records match your filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {result.columns.map((col) => (
                        <th
                          key={col.key}
                          className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {result.data.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50 transition-colors">
                        {result.columns.map((col) => {
                          const val = row[col.key];
                          let display = "";
                          if (val === null || val === undefined) {
                            display = "—";
                          } else if (col.type === "date" || col.type === "datetime") {
                            display = new Date(String(val)).toLocaleDateString();
                          } else if (col.type === "decimal" || col.type === "number") {
                            display = Number(val).toLocaleString();
                          } else {
                            display = String(val);
                          }
                          return (
                            <td key={col.key} className="px-4 py-3 text-gray-700 whitespace-nowrap">
                              {display}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Save modal */}
      {showSave && (
        <SaveReportModal
          onSave={handleSave}
          onClose={() => setShowSave(false)}
        />
      )}
    </div>
  );
}
