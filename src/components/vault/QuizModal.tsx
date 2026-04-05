"use client";

import { useState, useCallback } from "react";
import {
  X, ChevronRight, ChevronLeft, CheckCircle2, XCircle,
  Trophy, RotateCcw, ArrowRight, AlertCircle, Loader2,
  ClipboardCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { QuizSummary, QuizSubmitResult } from "@/modules/quiz/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QuizModalProps {
  quiz:       QuizSummary;
  videoTitle: string;
  onClose:    () => void;
  onPassed:   () => void;       // fires when user passes
}

type Phase = "intro" | "question" | "result";

// ---------------------------------------------------------------------------
// Option button
// ---------------------------------------------------------------------------

function OptionButton({
  label, text, selected, correct, wrong, disabled, onClick,
}: {
  label:    string;
  text:     string;
  selected: boolean;
  correct?: boolean;
  wrong?:   boolean;
  disabled: boolean;
  onClick:  () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group flex w-full items-start gap-3.5 rounded-2xl border p-4 text-left",
        "transition-all duration-200 active:scale-[0.99]",
        correct
          ? "border-emerald-500 bg-emerald-500/15 shadow-lg shadow-emerald-900/20"
          : wrong
          ? "border-red-500 bg-red-500/10"
          : selected
          ? "border-purple-500 bg-purple-500/15 shadow-lg shadow-purple-900/30"
          : "border-white/8 bg-white/3 hover:border-purple-400/50 hover:bg-white/6"
      )}
    >
      {/* Letter pill */}
      <span className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold transition-all",
        correct
          ? "bg-emerald-500 text-white"
          : wrong
          ? "bg-red-500 text-white"
          : selected
          ? "bg-purple-600 text-white"
          : "bg-white/10 text-zinc-400 group-hover:bg-purple-900/50 group-hover:text-purple-300"
      )}>
        {label}
      </span>

      {/* Text */}
      <span className={cn(
        "flex-1 text-sm font-medium leading-snug pt-0.5",
        correct ? "text-emerald-300"
        : wrong  ? "text-red-300"
        : selected ? "text-purple-200"
        : "text-zinc-300 group-hover:text-white"
      )}>
        {text}
      </span>

      {/* Indicator */}
      {correct && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />}
      {wrong   && <XCircle      className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />}
    </button>
  );
}

const LABELS = ["A", "B", "C", "D", "E"];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function QuizModal({ quiz, videoTitle, onClose, onPassed }: QuizModalProps) {
  const [phase,     setPhase]     = useState<Phase>("intro");
  const [current,  setCurrent]   = useState(0);           // question index
  const [answers,  setAnswers]   = useState<Record<string, number>>({});
  const [result,   setResult]    = useState<QuizSubmitResult | null>(null);
  const [error,    setError]     = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // animate slide direction
  const [slideDir, setSlideDir]  = useState<"left" | "right">("right");
  const [animated, setAnimated]  = useState(false);

  const questions = quiz.questions;
  const total     = questions.length;
  const q         = questions[current];
  const selected  = answers[q?.id ?? ""] ?? -1;
  const hasAnswer = selected !== -1;
  const allAnswered = questions.every((q) => answers[q.id] !== undefined);

  // ── Navigate ─────────────────────────────────────────────────────────────

  function animateTo(newIdx: number, dir: "left" | "right") {
    setSlideDir(dir);
    setAnimated(true);
    setTimeout(() => {
      setCurrent(newIdx);
      setAnimated(false);
    }, 150);
  }

  function goNext() {
    if (current < total - 1) animateTo(current + 1, "right");
  }

  function goPrev() {
    if (current > 0) animateTo(current - 1, "left");
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!allAnswered) {
      setError(`Please answer all ${total} questions before submitting.`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/vault/videos/${quiz.videoId}/quiz-submit`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ answers }),
      });
      const data = await res.json() as { success: boolean; result?: QuizSubmitResult; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? "Submission failed");
      setResult(data.result!);
      setPhase("result");
      if (data.result!.passed) onPassed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [allAnswered, answers, quiz.videoId, total, onPassed]);

  // ── Retry ─────────────────────────────────────────────────────────────────

  function retry() {
    setAnswers({});
    setCurrent(0);
    setResult(null);
    setError(null);
    setPhase("intro");
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={phase === "result" ? onClose : undefined} />

      {/* Card */}
      <div
        className="relative flex w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-white/8 shadow-2xl shadow-purple-900/40"
        style={{ background: "linear-gradient(160deg, #0f0f1a 0%, #13111e 50%, #0c0c14 100%)" }}
      >
        {/* Glow accents */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-purple-600/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 bottom-0 h-48 w-48 rounded-full bg-indigo-600/10 blur-3xl" />

        {/* ── Header ── */}
        <div
          className="relative flex items-center gap-3 px-6 py-4"
          style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.4) 0%, rgba(92,100,246,0.4) 100%)" }}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
            <ClipboardCheck className="h-4.5 w-4.5 text-purple-300" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-extrabold text-white">Knowledge Check</h2>
            <p className="text-[10px] text-white/50 truncate">{videoTitle}</p>
          </div>

          {/* Progress pills */}
          {phase === "question" && (
            <div className="flex items-center gap-1 mr-2">
              {questions.map((_, i) => (
                <button
                  key={i}
                  onClick={() => animateTo(i, i > current ? "right" : "left")}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    i === current
                      ? "w-5 bg-purple-400"
                      : answers[questions[i].id] !== undefined
                      ? "w-2.5 bg-purple-600/60"
                      : "w-2.5 bg-white/15"
                  )}
                />
              ))}
            </div>
          )}

          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white/60 transition-all hover:bg-white/20 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto">

          {/* ── INTRO PHASE ── */}
          {phase === "intro" && (
            <div className="flex flex-col items-center gap-6 p-8 text-center">
              <div
                className="flex h-20 w-20 items-center justify-center rounded-3xl shadow-xl shadow-purple-900/40"
                style={{ background: "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)" }}
              >
                <ClipboardCheck className="h-10 w-10 text-white" />
              </div>

              <div>
                <h3 className="text-xl font-extrabold text-white">Ready to test your knowledge?</h3>
                <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
                  Answer <strong className="text-white">{total} question{total !== 1 ? "s" : ""}</strong> about
                  this training video. You need{" "}
                  <strong className="text-purple-400">{quiz.passMark}% or higher</strong> to pass.
                </p>
              </div>

              <div className="grid w-full grid-cols-3 gap-3">
                {[
                  { label: "Questions",   value: String(total),          color: "text-purple-400" },
                  { label: "Pass Mark",   value: `${quiz.passMark}%`,    color: "text-emerald-400" },
                  { label: "Attempts",    value: "Unlimited",            color: "text-blue-400" },
                ].map((s) => (
                  <div key={s.label} className="rounded-2xl border border-white/8 bg-white/4 p-3 text-center">
                    <p className={`text-lg font-extrabold ${s.color}`}>{s.value}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">{s.label}</p>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setPhase("question")}
                className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white shadow-xl shadow-purple-900/40 transition-all hover:-translate-y-0.5 hover:brightness-110 hover:shadow-2xl active:scale-95"
                style={{ background: "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)" }}
              >
                Start Quiz <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* ── QUESTION PHASE ── */}
          {phase === "question" && q && (
            <div className="p-6 space-y-5">

              {/* Question counter + progress bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-purple-400">Question {current + 1} of {total}</span>
                  <span className="text-zinc-600">
                    {Object.keys(answers).length}/{total} answered
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-white/8">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${((current + 1) / total) * 100}%`,
                      background: "linear-gradient(90deg, #7c3aed, #a855f7)",
                    }}
                  />
                </div>
              </div>

              {/* Question text */}
              <div
                className={cn(
                  "transition-all duration-150",
                  animated ? (slideDir === "right" ? "opacity-0 translate-x-4" : "opacity-0 -translate-x-4") : "opacity-100 translate-x-0"
                )}
              >
                <p className="text-base font-bold text-white leading-relaxed">{q.question}</p>
              </div>

              {/* Options */}
              <div
                className={cn(
                  "space-y-2.5 transition-all duration-150",
                  animated ? "opacity-0" : "opacity-100"
                )}
              >
                {(q.options as string[]).map((opt, i) => (
                  <OptionButton
                    key={i}
                    label={LABELS[i]}
                    text={opt}
                    selected={selected === i}
                    disabled={false}
                    onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: i }))}
                  />
                ))}
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={goPrev}
                  disabled={current === 0}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-white/4 text-zinc-400 transition-all hover:border-purple-500/40 hover:text-white disabled:opacity-30"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>

                <div className="flex-1">
                  {current < total - 1 ? (
                    <button
                      onClick={goNext}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/8 bg-white/4 py-2.5 text-sm font-semibold text-zinc-300 transition-all hover:border-purple-500/40 hover:bg-purple-900/30 hover:text-white active:scale-95"
                    >
                      Next <ChevronRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className={cn(
                        "flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white shadow-lg transition-all duration-300 active:scale-95",
                        submitting
                          ? "bg-zinc-700 text-zinc-400 shadow-none cursor-not-allowed"
                          : "shadow-purple-900/40 hover:-translate-y-0.5 hover:brightness-110 hover:shadow-xl"
                      )}
                      style={submitting ? {} : { background: "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)" }}
                    >
                      {submitting ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</>
                      ) : (
                        <><CheckCircle2 className="h-4 w-4" /> Submit Quiz</>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Dot navigator */}
              <div className="flex items-center justify-center gap-1.5 pt-1">
                {questions.map((qq, i) => (
                  <button
                    key={i}
                    onClick={() => animateTo(i, i > current ? "right" : "left")}
                    className={cn(
                      "h-2 w-2 rounded-full transition-all",
                      i === current
                        ? "w-5 bg-purple-500"
                        : answers[qq.id] !== undefined
                        ? "bg-purple-700"
                        : "bg-white/15"
                    )}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── RESULT PHASE ── */}
          {phase === "result" && result && (
            <div className="flex flex-col gap-5 p-6">

              {/* Score card */}
              <div
                className={cn(
                  "relative overflow-hidden rounded-2xl p-6 text-center",
                  result.passed
                    ? "border border-emerald-500/30 bg-emerald-950/40"
                    : "border border-red-500/20 bg-red-950/30"
                )}
              >
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br opacity-20"
                  style={{ backgroundImage: result.passed
                    ? "radial-gradient(circle at 50% 0%, rgba(16,185,129,0.4), transparent 60%)"
                    : "radial-gradient(circle at 50% 0%, rgba(239,68,68,0.3), transparent 60%)" }}
                />

                {result.passed ? (
                  <Trophy className="mx-auto h-14 w-14 text-yellow-400 drop-shadow-lg" />
                ) : (
                  <XCircle className="mx-auto h-14 w-14 text-red-400" />
                )}

                <p className={cn(
                  "mt-3 text-4xl font-extrabold",
                  result.passed ? "text-emerald-400" : "text-red-400"
                )}>
                  {Math.round(result.score)}%
                </p>
                <p className={cn(
                  "mt-1 text-lg font-bold",
                  result.passed ? "text-emerald-300" : "text-red-300"
                )}>
                  {result.passed ? "🎉 Passed!" : "Not passed"}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {result.correctCount} of {result.totalQuestions} correct · Pass mark: {result.passMark}%
                </p>
              </div>

              {/* Review */}
              <div className="space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Review</p>
                {result.review.map((r, i) => (
                  <div
                    key={r.questionId}
                    className={cn(
                      "rounded-2xl border p-4",
                      r.isCorrect
                        ? "border-emerald-500/20 bg-emerald-950/30"
                        : "border-red-500/15 bg-red-950/20"
                    )}
                  >
                    <div className="flex items-start gap-2 mb-3">
                      {r.isCorrect
                        ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                        : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />}
                      <p className="text-sm font-semibold text-white leading-snug">{r.question}</p>
                    </div>

                    <div className="space-y-1.5 ml-6">
                      {(questions[i]?.options as string[] ?? []).map((opt, oi) => {
                        const isYours   = oi === r.yourAnswer;
                        const isCorrect = oi === r.correct;
                        return (
                          <div
                            key={oi}
                            className={cn(
                              "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs",
                              isCorrect && isYours  ? "bg-emerald-500/20 text-emerald-300 font-semibold"
                              : isCorrect           ? "bg-emerald-500/10 text-emerald-400"
                              : isYours             ? "bg-red-500/15 text-red-400 line-through"
                              : "text-zinc-600"
                            )}
                          >
                            <span className={cn(
                              "shrink-0 font-bold",
                              isCorrect ? "text-emerald-400" : isYours ? "text-red-400" : "text-zinc-600"
                            )}>
                              {LABELS[oi]}.
                            </span>
                            {opt}
                            {isCorrect && <CheckCircle2 className="ml-auto h-3 w-3 text-emerald-400" />}
                          </div>
                        );
                      })}
                    </div>

                    {r.explanation && (
                      <p className="mt-2 ml-6 text-xs text-zinc-500 leading-relaxed">
                        💡 {r.explanation}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                {!result.passed && (
                  <button
                    onClick={retry}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/8 bg-white/4 py-2.5 text-sm font-semibold text-zinc-300 transition-all hover:bg-white/8 hover:text-white active:scale-95"
                  >
                    <RotateCcw className="h-4 w-4" /> Try Again
                  </button>
                )}
                <button
                  onClick={onClose}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:brightness-110 active:scale-95",
                    result.passed ? "flex-1" : "w-32"
                  )}
                  style={{ background: result.passed
                    ? "linear-gradient(135deg, #059669 0%, #10b981 100%)"
                    : "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)"
                  }}
                >
                  {result.passed ? <><CheckCircle2 className="h-4 w-4" /> Continue</> : "Close"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
