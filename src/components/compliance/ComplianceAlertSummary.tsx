"use client";

import { useEffect, useState } from "react";
import { XCircle, AlertTriangle, CheckCircle } from "lucide-react";
import { useApiClient } from "@/lib/api-client";

interface ComplianceItem {
  id: string;
  status: "PENDING" | "UPCOMING" | "OVERDUE" | "COMPLETED";
}

export function ComplianceAlertSummary() {
  const api = useApiClient();
  const [overdue,  setOverdue]  = useState<number | null>(null);
  const [upcoming, setUpcoming] = useState<number | null>(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const items = await api.get<ComplianceItem[]>("/api/compliance");
        if (cancelled) return;
        setOverdue(items.filter((i) => i.status === "OVERDUE").length);
        setUpcoming(items.filter((i) => i.status === "UPCOMING").length);
      } catch {
        // fail silently — summary is non-critical
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [api]);

  if (loading) {
    return (
      <div className="flex gap-3">
        <div className="h-9 w-36 animate-pulse rounded-xl bg-white/10" />
        <div className="h-9 w-36 animate-pulse rounded-xl bg-white/10" />
      </div>
    );
  }

  // Nothing alarming
  if (overdue === 0 && upcoming === 0) {
    return (
      <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300">
        <CheckCircle className="h-4 w-4" />
        All compliance items on track
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      {(overdue ?? 0) > 0 && (
        <div className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300">
          <XCircle className="h-4 w-4 shrink-0" />
          ❌ {overdue} overdue {overdue === 1 ? "item" : "items"}
        </div>
      )}
      {(upcoming ?? 0) > 0 && (
        <div className="inline-flex items-center gap-2 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm font-semibold text-yellow-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          ⚠️ {upcoming} due soon
        </div>
      )}
    </div>
  );
}
