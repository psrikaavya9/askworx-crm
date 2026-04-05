"use client";

import { useState, useEffect, useCallback } from "react";
import { Play, Star, BookOpen, RefreshCw, AlertCircle, Loader2, ChevronRight, Video } from "lucide-react";
import Link from "next/link";
import { VideoCard }    from "@/components/vault/VideoCard";
import { listVideos }   from "@/lib/vault-api";
import { getAllLocalProgress, type LocalProgress } from "@/lib/videoProgress";
import type { HrVideo, VideoCategory } from "@/types/vault";

// ---------------------------------------------------------------------------
// Category tab config
// ---------------------------------------------------------------------------
const CATEGORY_TABS: { value: VideoCategory | "ALL"; label: string; emoji: string }[] = [
  { value: "ALL",        label: "All",        emoji: "🎬" },
  { value: "ONBOARDING", label: "Onboarding", emoji: "🚀" },
  { value: "TRAINING",   label: "Training",   emoji: "📚" },
  { value: "SAFETY",     label: "Safety",     emoji: "🦺" },
  { value: "COMPLIANCE", label: "Compliance", emoji: "✅" },
  { value: "GENERAL",    label: "General",    emoji: "📋" },
];

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------
function SectionHeader({
  icon, title, count, href,
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  href?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2.5">
        <span className="text-purple-400">{icon}</span>
        <h2 className="text-lg font-extrabold text-white">{title}</h2>
        {count !== undefined && (
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold text-white/60">
            {count}
          </span>
        )}
      </div>
      {href && count && count > 0 && (
        <Link
          href={href}
          className="flex items-center gap-1 text-xs font-semibold text-purple-400 transition-colors hover:text-purple-300"
        >
          See all <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function VideoVaultPage() {
  const [videos,   setVideos]   = useState<HrVideo[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, LocalProgress>>({});
  const [activeTab, setActiveTab] = useState<VideoCategory | "ALL">("ALL");

  // ── Load videos ───────────────────────────────────────────────────────────
  const loadVideos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listVideos({ limit: 100 });
      setVideos(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load videos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadVideos(); }, [loadVideos]);

  // ── Load progress from localStorage ─────────────────────────────────────
  useEffect(() => {
    setProgress(getAllLocalProgress());
  }, []);

  // ── Derived sections ─────────────────────────────────────────────────────
  const readyVideos = videos.filter((v) => v.status === "READY");

  const continueWatching = readyVideos.filter((v) => {
    const p = progress[v.id];
    return p && p.percentage > 1 && !p.completed;
  });

  const completedVideos = readyVideos.filter((v) => progress[v.id]?.completed);

  const requiredVideos = readyVideos.filter((v) => v.isRequired && !progress[v.id]?.completed);

  const filteredVideos = activeTab === "ALL"
    ? readyVideos
    : readyVideos.filter((v) => v.category === activeTab);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-full bg-[#0f0f0f] px-6 py-6 space-y-10">

      {/* ── Hero header ── */}
      <div className="relative overflow-hidden rounded-2xl border border-white/5 shadow-2xl shadow-purple-900/30">
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(135deg, #2e1065 0%, #1e1b4b 50%, #0f0f0f 100%)" }}
        />
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-purple-600/10 blur-3xl" />
        <div className="pointer-events-none absolute left-0 bottom-0 h-40 w-80 rounded-full bg-indigo-600/10 blur-3xl" />

        <div className="relative flex items-center justify-between px-8 py-8">
          <div className="flex items-center gap-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-600/30 ring-1 ring-purple-500/30 shadow-lg">
              <Play className="h-8 w-8 fill-purple-300 text-purple-300 ml-0.5" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-white">
                Training Videos
              </h1>
              <p className="mt-1 text-sm text-white/50">
                Your company's learning library — watch, progress, complete.
              </p>
            </div>
          </div>

          {/* Quick stats */}
          <div className="hidden gap-6 sm:flex">
            {[
              { label: "Total",     value: readyVideos.length,      color: "text-white" },
              { label: "In Progress", value: continueWatching.length, color: "text-purple-400" },
              { label: "Completed", value: completedVideos.length,   color: "text-emerald-400" },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className={`text-2xl font-extrabold leading-none ${s.color}`}>{s.value}</p>
                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-white/40">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Loading / Error ── */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-purple-500" />
          <p className="text-sm font-medium text-zinc-500">Loading your training library…</p>
        </div>
      )}

      {!loading && error && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-red-900/40 bg-red-950/30 py-16 text-center gap-4">
          <AlertCircle className="h-10 w-10 text-red-500" />
          <div>
            <p className="text-base font-bold text-white">Failed to Load Videos</p>
            <p className="mt-1 text-sm text-zinc-500">{error}</p>
            <p className="mt-0.5 text-xs text-zinc-600">Make sure the Vault server is running on port 4001</p>
          </div>
          <button
            onClick={loadVideos}
            className="flex items-center gap-2 rounded-xl bg-zinc-800 px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-zinc-700 active:scale-95"
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* ── Continue Watching ── */}
          {continueWatching.length > 0 && (
            <section>
              <SectionHeader
                icon={<Play className="h-5 w-5" />}
                title="Continue Watching"
                count={continueWatching.length}
              />
              <div className="flex gap-4 overflow-x-auto pb-2 scroll-smooth" style={{ scrollbarWidth: "none" }}>
                {continueWatching.map((v) => (
                  <VideoCard key={v.id} video={v} progress={progress[v.id]} compact />
                ))}
              </div>
            </section>
          )}

          {/* ── Completed ── */}
          {completedVideos.length > 0 && (
            <section>
              <SectionHeader
                icon={<BookOpen className="h-5 w-5" />}
                title="Completed"
                count={completedVideos.length}
              />
              <div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
                {completedVideos.map((v) => (
                  <VideoCard key={v.id} video={v} progress={progress[v.id]} compact />
                ))}
              </div>
            </section>
          )}

          {/* ── Required Training ── */}
          {requiredVideos.length > 0 && (
            <section>
              <SectionHeader
                icon={<Star className="h-5 w-5" />}
                title="Required Training"
                count={requiredVideos.length}
              />
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {requiredVideos.map((v) => (
                  <VideoCard key={v.id} video={v} progress={progress[v.id]} />
                ))}
              </div>
            </section>
          )}

          {/* ── All Videos ── */}
          <section>
            <SectionHeader
              icon={<Video className="h-5 w-5" />}
              title="All Training"
              count={filteredVideos.length}
            />

            {/* Category tabs */}
            <div className="mb-5 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {CATEGORY_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-all duration-200 ${
                    activeTab === tab.value
                      ? "bg-purple-600 text-white shadow-lg shadow-purple-900/50"
                      : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white border border-white/5"
                  }`}
                >
                  <span>{tab.emoji}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {filteredVideos.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-white/2 py-16 text-center gap-4">
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-2xl shadow-xl shadow-purple-900/30"
                  style={{ background: "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)" }}
                >
                  <Video className="h-8 w-8 text-white" />
                </div>
                <div>
                  <p className="text-base font-bold text-white">No Videos Found</p>
                  <p className="mt-1 text-sm text-zinc-600">
                    {activeTab === "ALL"
                      ? "No training videos have been uploaded yet."
                      : `No ${activeTab.toLowerCase()} videos available.`}
                  </p>
                </div>
                {activeTab !== "ALL" && (
                  <button
                    onClick={() => setActiveTab("ALL")}
                    className="rounded-xl bg-white/5 px-5 py-2 text-sm font-semibold text-zinc-400 transition-all hover:bg-white/10 hover:text-white"
                  >
                    Show All Categories
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {filteredVideos.map((v) => (
                  <VideoCard key={v.id} video={v} progress={progress[v.id]} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
