"use client";

import { cn } from "@/lib/utils";
import type { TimelineItem } from "@/lib/services/timeline";

// ---------------------------------------------------------------------------
// Date formatter — "Jan 5, 2026 • 10:30 AM"
// ---------------------------------------------------------------------------

function fmtDate(date: Date | string): string {
  const d = new Date(date);
  const datePart = d.toLocaleDateString("en-US", {
    month: "short",
    day:   "numeric",
    year:  "numeric",
  });
  const timePart = d.toLocaleTimeString("en-US", {
    hour:   "numeric",
    minute: "2-digit",
  });
  return `${datePart} • ${timePart}`;
}

// ---------------------------------------------------------------------------
// Per-type colour config
// ---------------------------------------------------------------------------

type TypeConfig = {
  iconBg:   string;
  dotColor: string;
};

const TYPE_CONFIG: Record<string, TypeConfig> = {
  CALL:               { iconBg: "bg-blue-50",    dotColor: "bg-blue-500"    },
  VISIT:              { iconBg: "bg-emerald-50", dotColor: "bg-emerald-500" },
  NOTE:               { iconBg: "bg-amber-50",   dotColor: "bg-amber-500"   },
  PROJECT:            { iconBg: "bg-violet-50",  dotColor: "bg-violet-500"  },
  PROJECT_CREATED:    { iconBg: "bg-violet-50",  dotColor: "bg-violet-500"  },
  PROJECT_COMPLETED:  { iconBg: "bg-violet-50",  dotColor: "bg-violet-500"  },
  PROJECT_ON_HOLD:    { iconBg: "bg-orange-50",  dotColor: "bg-orange-400"  },
  INVOICE:            { iconBg: "bg-orange-50",  dotColor: "bg-orange-500"  },
  INVOICE_ISSUED:     { iconBg: "bg-teal-50",    dotColor: "bg-teal-500"    },
  INVOICE_PAID:       { iconBg: "bg-green-50",   dotColor: "bg-green-500"   },
  INVOICE_OVERDUE:    { iconBg: "bg-red-50",     dotColor: "bg-red-500"     },
  PAYMENT:            { iconBg: "bg-purple-50",  dotColor: "bg-purple-500"  },
  PAYMENT_RECEIVED:   { iconBg: "bg-purple-50",  dotColor: "bg-purple-500"  },
  COMPLAINT:          { iconBg: "bg-red-50",     dotColor: "bg-red-500"     },
  COMPLAINT_RAISED:   { iconBg: "bg-rose-50",    dotColor: "bg-rose-500"    },
  COMPLAINT_RESOLVED: { iconBg: "bg-green-50",   dotColor: "bg-green-500"   },
};

const FALLBACK_CONFIG: TypeConfig = {
  iconBg:   "bg-gray-100",
  dotColor: "bg-gray-400",
};

function getConfig(type: string): TypeConfig {
  return TYPE_CONFIG[type] ?? FALLBACK_CONFIG;
}

// ---------------------------------------------------------------------------
// Month section divider
// ---------------------------------------------------------------------------

function MonthDivider({ label }: { label: string }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <div className="h-px flex-1 bg-gray-100" />
      <span className="shrink-0 text-[11px] font-bold uppercase tracking-widest text-gray-400">
        {label}
      </span>
      <div className="h-px flex-1 bg-gray-100" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single event row
// ---------------------------------------------------------------------------

function TimelineRow({
  item,
  isLast,
}: {
  item: TimelineItem;
  isLast: boolean;
}) {
  const cfg = getConfig(item.type);

  return (
    <div className="relative flex gap-4 pb-6 last:pb-0">
      {/* Vertical connector line — hidden on the last item in a group */}
      {!isLast && (
        <div className="absolute left-[19px] top-10 bottom-0 w-px bg-gray-100" />
      )}

      {/* Icon bubble */}
      <div className="relative z-10 shrink-0">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full border-2 border-white text-lg shadow-sm select-none",
            cfg.iconBg,
          )}
          aria-hidden="true"
        >
          {item.icon}
        </div>
        {/* Coloured status dot */}
        <span
          className={cn(
            "absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white",
            cfg.dotColor,
          )}
        />
      </div>

      {/* Content card */}
      <div className="flex-1 min-w-0 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm ring-1 ring-black/[0.03] transition-shadow hover:shadow-md">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <span className="text-sm font-semibold text-gray-800 leading-snug">
            {item.title}
          </span>
          <time className="shrink-0 text-xs text-gray-400 tabular-nums whitespace-nowrap">
            {fmtDate(item.date)}
          </time>
        </div>

        {/* Description */}
        {item.description && (
          <p className="mt-1.5 text-xs leading-relaxed text-gray-500 line-clamp-2">
            {item.description}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton loader — use while data is fetching via Suspense
// ---------------------------------------------------------------------------

export function TimelineSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {/* Icon placeholder */}
          <div className="h-10 w-10 shrink-0 rounded-full bg-gray-100" />
          {/* Card placeholder */}
          <div className="flex-1 rounded-xl border border-gray-100 bg-white px-4 py-3 space-y-2.5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="h-4 w-36 rounded-md bg-gray-100" />
              <div className="h-3 w-28 rounded-md bg-gray-100" />
            </div>
            <div className="h-3 w-full rounded-md bg-gray-100" />
            <div className="h-3 w-3/5 rounded-md bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-2xl select-none">
        🕐
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-700">No activity yet</p>
        <p className="mt-1 text-xs text-gray-400">
          Calls, visits, invoices, and projects will appear here.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export interface TimelineProps {
  items: TimelineItem[];
}

export function Timeline({ items }: TimelineProps) {
  if (items.length === 0) return <EmptyState />;

  // Group events into "Month Year" buckets — preserves sort order within each group
  const grouped = new Map<string, TimelineItem[]>();

  for (const item of items) {
    const key = new Date(item.date).toLocaleDateString("en-US", {
      month: "long",
      year:  "numeric",
    });
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(item);
  }

  return (
    <div className="space-y-2">
      {[...grouped.entries()].map(([month, events]) => (
        <div key={month} className="mb-2">
          <MonthDivider label={month} />
          <div>
            {events.map((item, i) => (
              <TimelineRow
                key={item.id}
                item={item}
                isLast={i === events.length - 1}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
