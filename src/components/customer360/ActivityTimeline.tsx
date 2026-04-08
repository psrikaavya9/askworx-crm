import type { TimelineEvent, TimelineEventType } from "@/modules/customer360/types/timeline.types";

// ---------------------------------------------------------------------------
// Emoji + label per event type
// ---------------------------------------------------------------------------

const EVENT_META: Record<TimelineEventType, { emoji: string; label: string }> = {
  CALL:               { emoji: "📞", label: "Call"      },
  VISIT:              { emoji: "📍", label: "Visit"     },
  NOTE:               { emoji: "📝", label: "Note"      },
  EMAIL:              { emoji: "✉️",  label: "Email"     },
  WHATSAPP:           { emoji: "💬", label: "WhatsApp"  },
  PROJECT_CREATED:    { emoji: "📁", label: "Project"   },
  PROJECT_COMPLETED:  { emoji: "✅", label: "Completed" },
  PROJECT_ON_HOLD:    { emoji: "⏸️",  label: "On Hold"  },
  INVOICE_ISSUED:     { emoji: "🧾", label: "Invoice"   },
  INVOICE_PAID:       { emoji: "✅", label: "Paid"      },
  INVOICE_OVERDUE:    { emoji: "⚠️",  label: "Overdue"  },
  PAYMENT_RECEIVED:   { emoji: "💰", label: "Payment"   },
  COMPLAINT_RAISED:   { emoji: "🚨", label: "Complaint" },
  COMPLAINT_RESOLVED: { emoji: "🛡️",  label: "Resolved" },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day:   "numeric",
    year:  "numeric",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  timeline: TimelineEvent[];
  /** Max rows to show before truncating. Defaults to 20. */
  limit?: number;
}

export function ActivityTimeline({ timeline, limit = 20 }: Props) {
  const items = timeline.slice(0, limit);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Activity Timeline</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            All interactions, projects and payments — latest first
          </p>
        </div>
        {timeline.length > limit && (
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
            +{timeline.length - limit} more in Timeline tab
          </span>
        )}
      </div>

      {/* Body */}
      <div className="divide-y divide-gray-50 px-6">
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <span className="text-3xl">📋</span>
            <p className="text-sm font-medium text-gray-500">No activity yet</p>
            <p className="text-xs text-gray-400">Interactions, projects and invoices will appear here.</p>
          </div>
        ) : (
          items.map((item) => {
            const meta    = EVENT_META[item.type] ?? { emoji: "📌", label: item.type };
            const dateStr = formatDate(item.date);

            return (
              <div key={item.id} className="flex items-start gap-4 py-3.5">
                {/* Emoji dot */}
                <span
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-50 text-base"
                  title={meta.label}
                >
                  {meta.emoji}
                </span>

                {/* Text */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-sm font-medium text-gray-800">{item.title}</span>
                    <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                      {meta.label}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {item.description || "No details available"}
                  </p>
                </div>

                {/* Date */}
                <time className="shrink-0 text-xs text-gray-400 tabular-nums">{dateStr}</time>
              </div>
            );
          })
        )}
      </div>

      {/* Footer hint when truncated */}
      {timeline.length > limit && (
        <div className="border-t border-gray-100 px-6 py-3 text-center">
          <p className="text-xs text-gray-400">
            Showing latest {limit} of {timeline.length} events — see the{" "}
            <span className="font-medium text-indigo-600">Timeline</span> tab above for full history
          </p>
        </div>
      )}
    </section>
  );
}
