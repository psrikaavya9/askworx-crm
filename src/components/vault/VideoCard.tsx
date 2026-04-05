"use client";

import Link from "next/link";
import { Play, Clock, CheckCircle2, Lock, Star, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HrVideo, VideoCategory } from "@/types/vault";
import type { LocalProgress } from "@/lib/videoProgress";

// ---------------------------------------------------------------------------
// Category config
// ---------------------------------------------------------------------------

const CAT_CONFIG: Record<VideoCategory, {
  label:    string;
  emoji:    string;
  gradient: string;
  badge:    string;
}> = {
  ONBOARDING: { label: "Onboarding",  emoji: "🚀", gradient: "from-violet-950 via-purple-900 to-indigo-900", badge: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
  TRAINING:   { label: "Training",    emoji: "📚", gradient: "from-blue-950 via-blue-900 to-cyan-900",       badge: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  SAFETY:     { label: "Safety",      emoji: "🦺", gradient: "from-red-950 via-red-900 to-orange-900",       badge: "bg-red-500/20 text-red-300 border-red-500/30" },
  COMPLIANCE: { label: "Compliance",  emoji: "✅", gradient: "from-emerald-950 via-green-900 to-teal-900",   badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  GENERAL:    { label: "General",     emoji: "📋", gradient: "from-zinc-900 via-zinc-800 to-slate-900",      badge: "bg-zinc-500/20 text-zinc-300 border-zinc-500/30" },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDuration(secs: number | null): string {
  if (!secs) return "";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface VideoCardProps {
  video:     HrVideo;
  progress?: LocalProgress | null;
  /** horizontal compact layout for Continue Watching row */
  compact?:  boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VideoCard({ video, progress, compact = false }: VideoCardProps) {
  const cfg          = CAT_CONFIG[video.category] ?? CAT_CONFIG.GENERAL;
  const pct          = progress?.percentage ?? 0;
  const isComplete   = progress?.completed ?? false;
  const quizPending  = !isComplete && (progress?.quizPending ?? false);
  const hasProg      = pct > 0 && !isComplete;
  const dur          = fmtDuration(video.duration);

  return (
    <Link
      href={`/vault/videos/${video.id}`}
      className={cn(
        "group relative block overflow-hidden rounded-2xl bg-[#1c1c1e]",
        "border border-white/5 transition-all duration-300",
        "hover:-translate-y-1 hover:scale-[1.02] hover:border-purple-500/30",
        "hover:shadow-2xl hover:shadow-purple-900/40",
        compact ? "w-64 shrink-0" : "w-full"
      )}
    >
      {/* ── Thumbnail ── */}
      <div className="relative aspect-video overflow-hidden">

        {video.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          /* Gradient placeholder */
          <div className={cn(
            "flex h-full w-full items-center justify-center bg-gradient-to-br",
            cfg.gradient
          )}>
            <span className="text-5xl opacity-40 transition-transform duration-300 group-hover:scale-110 group-hover:opacity-60">
              {cfg.emoji}
            </span>
          </div>
        )}

        {/* Dark vignette overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Top-left: category badge */}
        <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5">
          <span className={cn(
            "rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm",
            cfg.badge
          )}>
            {cfg.label}
          </span>
          {video.isRequired && (
            <span className="flex items-center gap-0.5 rounded-lg border border-orange-500/40 bg-orange-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-300 backdrop-blur-sm">
              <Star className="h-2.5 w-2.5" /> Required
            </span>
          )}
        </div>

        {/* Top-right: duration */}
        {dur && (
          <div className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-lg bg-black/60 px-2 py-0.5 backdrop-blur-sm">
            <Clock className="h-3 w-3 text-white/60" />
            <span className="text-[10px] font-semibold tabular-nums text-white/90">{dur}</span>
          </div>
        )}

        {/* Status badge */}
        {isComplete && (
          <div className="absolute right-2.5 bottom-7 flex items-center gap-1.5 rounded-full bg-emerald-500/90 px-2.5 py-1 backdrop-blur-sm shadow-lg shadow-emerald-900/50">
            <CheckCircle2 className="h-3 w-3 text-white" />
            <span className="text-[10px] font-bold text-white">Completed</span>
          </div>
        )}
        {quizPending && (
          <div className="absolute right-2.5 bottom-7 flex items-center gap-1.5 rounded-full bg-amber-500/90 px-2.5 py-1 backdrop-blur-sm shadow-lg shadow-amber-900/50">
            <ClipboardList className="h-3 w-3 text-white" />
            <span className="text-[10px] font-bold text-white">Quiz Required</span>
          </div>
        )}
        {video.status === "PROCESSING" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-purple-500" />
              <span className="text-xs font-semibold text-white/70">Processing…</span>
            </div>
          </div>
        )}
        {video.status === "FAILED" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <Lock className="h-8 w-8 text-red-400" />
          </div>
        )}

        {/* Center play button (on hover) */}
        {video.status === "READY" && (
          <div className={cn(
            "absolute inset-0 flex items-center justify-center transition-all duration-300",
            "opacity-0 group-hover:opacity-100"
          )}>
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 ring-2 ring-white/30 backdrop-blur-sm shadow-xl shadow-black/50 transition-transform duration-200 group-hover:scale-110">
              <Play className="h-6 w-6 fill-white text-white ml-0.5" />
            </div>
          </div>
        )}

        {/* Progress bar overlay at bottom */}
        {hasProg && (
          <div className="absolute inset-x-0 bottom-0 h-1">
            <div className="h-full w-full bg-white/10" />
            <div
              className="absolute inset-y-0 left-0 h-full rounded-r-full"
              style={{
                width: `${Math.min(100, pct)}%`,
                background: "linear-gradient(90deg, #7c3aed, #a855f7)",
              }}
            />
          </div>
        )}
      </div>

      {/* ── Card body ── */}
      <div className="p-3.5">
        <h3 className="line-clamp-2 text-sm font-bold text-white leading-snug">
          {video.title}
        </h3>

        {video.description && !compact && (
          <p className="mt-1 line-clamp-1 text-xs text-zinc-500 leading-relaxed">
            {video.description}
          </p>
        )}

        {/* Progress or completion */}
        <div className="mt-2.5 flex items-center gap-2">
          {isComplete ? (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-500">
              <CheckCircle2 className="h-3 w-3" /> Completed
            </span>
          ) : quizPending ? (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-500">
              <ClipboardList className="h-3 w-3" /> Quiz Required
            </span>
          ) : hasProg ? (
            <>
              <div className="flex-1 overflow-hidden rounded-full bg-white/10" style={{ height: 3 }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, pct)}%`,
                    background: "linear-gradient(90deg, #7c3aed, #a855f7)",
                  }}
                />
              </div>
              <span className="shrink-0 text-[10px] font-semibold tabular-nums text-zinc-500">
                {Math.round(pct)}%
              </span>
            </>
          ) : (
            <span className="text-[10px] text-zinc-600">Not started</span>
          )}
        </div>
      </div>
    </Link>
  );
}
