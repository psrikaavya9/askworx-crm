import { ClipboardCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { serializePrisma } from "@/lib/serialize";
import { ReviewsDashboard } from "@/components/reviews/ReviewsDashboard";
import type { ReviewRow } from "@/components/reviews/ReviewsDashboard";

// ---------------------------------------------------------------------------
// Reviews page — Owner only
//
// Shows all interactions that have not yet been approved so the owner can
// approve, reject, or send back for editing in one place.
//
// This is a server component: data is fetched at request time so the list
// is always fresh on navigation. Actions (approve / reject / request-edit)
// are handled client-side via the authenticated API client.
// ---------------------------------------------------------------------------

export const dynamic = "force-dynamic";

async function fetchPendingInteractions() {
  return prisma.customerInteraction.findMany({
    where:   { approved: false },
    orderBy: { date: "desc" },
    take:    200,
    include: {
      client: {
        select: { id: true, firstName: true, lastName: true, company: true },
      },
      staff: {
        select: { firstName: true, lastName: true, department: true },
      },
    },
  });
}

export default async function ReviewsPage() {
  const rows  = await fetchPendingInteractions();
  const total = rows.length;

  const serialized = serializePrisma(rows) as unknown as ReviewRow[];

  const pendingCount       = rows.filter((r) => !r.rejected && !r.ownerNote).length;
  const editRequestedCount = rows.filter((r) => !r.rejected &&  r.ownerNote != null).length;
  const rejectedCount      = rows.filter((r) =>  r.rejected).length;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50">
            <ClipboardCheck className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Interaction Reviews</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Review, approve, or send back staff-logged interactions
            </p>
          </div>
        </div>

        {/* Summary KPIs */}
        <div className="flex items-center gap-3">
          {[
            { label: "Pending",       value: pendingCount,       color: "text-gray-700",    bg: "bg-gray-50   border-gray-200" },
            { label: "Edit Requested",value: editRequestedCount, color: "text-orange-700",  bg: "bg-orange-50 border-orange-200" },
            { label: "Rejected",      value: rejectedCount,      color: "text-red-700",     bg: "bg-red-50    border-red-200" },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`rounded-xl border px-4 py-2.5 text-center ${bg}`}>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="text-[11px] text-gray-400">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Dashboard */}
      <ReviewsDashboard initialRows={serialized} initialTotal={total} />
    </div>
  );
}
