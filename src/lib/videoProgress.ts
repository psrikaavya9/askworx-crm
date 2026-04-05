/**
 * Client-side video progress store (localStorage).
 * Provides fast reads for dashboard cards without extra API calls.
 * The API (saveWatchProgress) is the source of truth — this is a cache.
 */

const KEY = (id: string) => `vault_vp_${id}`;

export interface LocalProgress {
  percentage:   number;  // 0–100
  lastPosition: number;  // seconds
  completed:    boolean;
  quizPending?: boolean; // reached 90% but quiz not yet passed
  quizPassed?:  boolean; // quiz has been passed
  updatedAt:    string;  // ISO
}

export function getLocalProgress(videoId: string): LocalProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY(videoId));
    return raw ? (JSON.parse(raw) as LocalProgress) : null;
  } catch {
    return null;
  }
}

export function setLocalProgress(videoId: string, progress: LocalProgress): void {
  if (typeof window === "undefined") return;
  try {
    // Only update if progress increased (never decrease)
    const existing = getLocalProgress(videoId);
    if (existing && existing.percentage > progress.percentage && !progress.completed) return;
    localStorage.setItem(KEY(videoId), JSON.stringify(progress));
  } catch {
    /* storage full — ignore */
  }
}

export function getAllLocalProgress(): Record<string, LocalProgress> {
  if (typeof window === "undefined") return {};
  const result: Record<string, LocalProgress> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("vault_vp_")) {
        const id  = key.slice("vault_vp_".length);
        const raw = localStorage.getItem(key);
        if (raw) result[id] = JSON.parse(raw) as LocalProgress;
      }
    }
  } catch { /* ignore */ }
  return result;
}

export function clearLocalProgress(videoId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY(videoId));
}
