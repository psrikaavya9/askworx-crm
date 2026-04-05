"use client";

import { useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  X, Pen, Type, Trash2, CheckCircle2, Loader2,
  ShieldCheck, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { acknowledgeDocument } from "@/lib/vault-api";
import type { HrDocument } from "@/types/vault";

// Dynamically import signature canvas (no SSR).
// typed as `any` so that `ref` and all canvas props pass through.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SignatureCanvas = dynamic<any>(() => import("react-signature-canvas"), { ssr: false });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SigCanvasRef = any;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface SignatureModalProps {
  doc:           HrDocument;
  onClose:       () => void;
  onAcknowledged: (docId: string) => void;
}

type Mode = "draw" | "type";

const FONTS = [
  { label: "Script",   font: "'Dancing Script', cursive" },
  { label: "Formal",   font: "'Pinyon Script', cursive" },
  { label: "Print",    font: "'Caveat', cursive" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function SignatureModal({ doc, onClose, onAcknowledged }: SignatureModalProps) {
  const sigRef  = useRef<SigCanvasRef>(null);
  const [mode, setMode]               = useState<Mode>("draw");
  const [typedSig, setTypedSig]       = useState("");
  const [fontIdx, setFontIdx]         = useState(0);
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [isEmpty, setIsEmpty]         = useState(true);
  const [confirmed, setConfirmed]     = useState(false);

  // ── Canvas helpers ──────────────────────────────────────────────────────
  const handleDrawEnd = useCallback(() => {
    setIsEmpty(sigRef.current?.isEmpty() ?? true);
  }, []);

  const clearDraw = useCallback(() => {
    sigRef.current?.clear();
    setIsEmpty(true);
  }, []);

  // ── Derive a base64 signature ───────────────────────────────────────────
  function getSignatureBase64(): string | null {
    if (mode === "draw") {
      if (!sigRef.current || sigRef.current.isEmpty()) return null;
      return sigRef.current.toDataURL("image/png");
    } else {
      if (!typedSig.trim()) return null;
      // Render typed signature onto an offscreen canvas
      const canvas = document.createElement("canvas");
      canvas.width  = 400;
      canvas.height = 120;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 400, 120);
      ctx.fillStyle = "#1e1b4b";
      ctx.font      = `52px ${FONTS[fontIdx].font}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(typedSig.slice(0, 30), 200, 60);
      return canvas.toDataURL("image/png");
    }
  }

  const canSubmit = mode === "draw" ? !isEmpty : typedSig.trim().length > 0;

  // ── Submit ──────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!confirmed) { setError("Please tick the confirmation checkbox."); return; }
    const sig = getSignatureBase64();
    if (!sig) { setError("Please provide your signature."); return; }

    setSubmitting(true);
    setError(null);
    try {
      await acknowledgeDocument(doc.id, { signature: sig });
      onAcknowledged(doc.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Acknowledgement failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <>
      {/* Load cursive fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600&family=Pinyon+Script&family=Caveat:wght@600&display=swap');
      `}</style>

      {/* ── Backdrop (glassmorphism) ── */}
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center p-4"
        style={{ background: "linear-gradient(135deg, rgba(210,92,246,0.35) 0%, rgba(92,100,246,0.35) 100%)" }}
      >
        {/* Blur backdrop layer */}
        <div className="absolute inset-0 backdrop-blur-md" onClick={onClose} />

        {/* ── Modal card ── */}
        <div
          className="relative w-full max-w-lg overflow-hidden rounded-3xl shadow-2xl shadow-purple-900/40 border border-white/30"
          style={{
            background: "linear-gradient(160deg, rgba(255,255,255,0.97) 0%, rgba(248,245,255,0.97) 100%)",
          }}
        >
          {/* Glow accents */}
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-purple-300/20 blur-3xl" />
          <div className="pointer-events-none absolute -left-16 bottom-0 h-48 w-48 rounded-full bg-indigo-300/20 blur-3xl" />

          {/* ── Top gradient banner ── */}
          <div
            className="relative px-6 py-5"
            style={{ background: "linear-gradient(135deg, #d25cf6 0%, #5c64f6 100%)" }}
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 ring-1 ring-white/30 shadow-lg">
                  <ShieldCheck className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-white">Acknowledge & Sign</h2>
                  <p className="text-xs text-white/65 mt-0.5 max-w-[220px] truncate">{doc.title}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 text-white transition-all hover:bg-white/30 active:scale-95"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* ── Body ── */}
          <div className="relative space-y-5 p-6">

            {/* Legal notice */}
            <div className="rounded-2xl border border-purple-100 bg-purple-50/60 px-4 py-3 text-xs leading-relaxed text-purple-800">
              By signing below you confirm that you have <strong>read, understood, and agree</strong> to
              comply with the contents of <strong>&ldquo;{doc.title}&rdquo;</strong>.
              This electronic signature carries the same legal weight as a physical signature.
            </div>

            {/* Mode tabs */}
            <div className="flex items-center rounded-2xl bg-gray-100/80 p-1">
              {(["draw", "type"] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError(null); }}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-sm font-bold transition-all duration-200",
                    mode === m
                      ? "bg-white text-purple-700 shadow-md shadow-purple-100"
                      : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  {m === "draw" ? <Pen className="h-3.5 w-3.5" /> : <Type className="h-3.5 w-3.5" />}
                  {m === "draw" ? "Draw" : "Type"}
                </button>
              ))}
            </div>

            {/* ── Draw mode ── */}
            {mode === "draw" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                    Draw your signature
                  </label>
                  <button
                    onClick={clearDraw}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-gray-500 transition-all hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-3 w-3" /> Clear
                  </button>
                </div>
                <div
                  className="relative overflow-hidden rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 transition-all"
                  style={{ height: 160 }}
                >
                  {isEmpty && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <p className="text-sm text-gray-300 font-medium select-none">
                        Sign here with your mouse or finger
                      </p>
                    </div>
                  )}
                  <SignatureCanvas
                    ref={sigRef}
                    onEnd={handleDrawEnd}
                    canvasProps={{
                      className: "w-full h-full",
                      style: { touchAction: "none" },
                    }}
                    backgroundColor="transparent"
                    penColor="#1e1b4b"
                  />
                  {/* Bottom guide line */}
                  <div className="pointer-events-none absolute inset-x-6 bottom-10 h-px bg-gray-200" />
                </div>
              </div>
            )}

            {/* ── Type mode ── */}
            {mode === "type" && (
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                    Type your full name
                  </label>
                  <input
                    type="text"
                    value={typedSig}
                    onChange={(e) => setTypedSig(e.target.value.slice(0, 40))}
                    placeholder="Your full name…"
                    className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm shadow-sm transition-all focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-100"
                  />
                </div>

                {/* Font picker */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                    Choose style
                  </label>
                  <div className="mt-1.5 grid grid-cols-3 gap-2">
                    {FONTS.map((f, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setFontIdx(i)}
                        className={cn(
                          "rounded-xl border py-3 text-xl transition-all hover:-translate-y-0.5",
                          fontIdx === i
                            ? "border-purple-300 bg-purple-50 shadow-md shadow-purple-100"
                            : "border-gray-200 bg-white hover:border-purple-200"
                        )}
                        style={{ fontFamily: f.font, color: "#1e1b4b" }}
                      >
                        {typedSig || f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview */}
                {typedSig && (
                  <div className="flex items-center justify-center rounded-2xl border border-gray-100 bg-gray-50 py-4">
                    <div className="border-b border-gray-300 pb-1">
                      <span
                        className="text-4xl text-indigo-900"
                        style={{ fontFamily: FONTS[fontIdx].font }}
                      >
                        {typedSig}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Confirmation checkbox */}
            <label
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-all",
                confirmed
                  ? "border-purple-200 bg-purple-50/60"
                  : "border-gray-200 bg-gray-50/50 hover:border-purple-200"
              )}
            >
              <div className="relative mt-0.5 shrink-0">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => { setConfirmed(e.target.checked); setError(null); }}
                  className="sr-only"
                />
                <div className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-md border-2 transition-all",
                  confirmed ? "border-purple-600 bg-purple-600" : "border-gray-300 bg-white"
                )}>
                  {confirmed && (
                    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 12 12">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              </div>
              <p className={cn(
                "text-xs leading-relaxed transition-colors",
                confirmed ? "text-purple-700 font-medium" : "text-gray-600"
              )}>
                I confirm I have read and understood this document and this signature represents my
                binding acknowledgement as of {new Date().toLocaleDateString("en-IN", {
                  day: "numeric", month: "long", year: "numeric",
                })}.
              </p>
            </label>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                <p className="text-sm font-medium text-red-700">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={onClose}
                className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50 active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !canSubmit}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white shadow-lg transition-all duration-300",
                  submitting || !canSubmit
                    ? "cursor-not-allowed bg-gray-300 text-gray-400 shadow-none"
                    : "shadow-purple-200 hover:-translate-y-0.5 hover:brightness-110 hover:shadow-xl active:scale-95"
                )}
                style={submitting || !canSubmit ? {} : { background: "linear-gradient(135deg, #d25cf6 0%, #5c64f6 100%)" }}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Acknowledge & Sign
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
