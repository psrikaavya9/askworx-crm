import { prisma } from "@/lib/prisma";
import { serializePrisma } from "@/lib/serialize";
import { CustomersTable, type CustomerRow, type CustomerHealthData } from "@/components/customer/CustomersTable";
import { UserCircle2, AlertTriangle } from "lucide-react";
import { calculateHealthScoreFull } from "@/lib/services/healthScore";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface PageProps {
  searchParams: Promise<Record<string, string>>;
}

export default async function CustomersPage({ searchParams }: PageProps) {
  const { q } = await searchParams;

  // ── Fetch customers + latest health scores in parallel ──────────────────
  const [rawCustomers, rawScores] = await Promise.all([
    prisma.client.findMany({
      where: q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName:  { contains: q, mode: "insensitive" } },
              { company:   { contains: q, mode: "insensitive" } },
              { phone:     { contains: q, mode: "insensitive" } },
              { email:     { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      select: {
        id:        true,
        firstName: true,
        lastName:  true,
        email:     true,
        phone:     true,
        company:   true,
        jobTitle:  true,
        tags:      true,
        createdAt: true,
      },
    }),

    // One query for all latest scores — distinct keeps only the newest row
    // per client. The @@index([clientId, calculatedAt]) on the schema makes
    // this fast even with years of historical score rows.
    prisma.customerHealthScore.findMany({
      orderBy: { calculatedAt: "desc" },
      distinct: ["clientId"],
      select: {
        clientId:         true,
        score:            true,
        paymentScore:     true,
        engagementScore:  true,
        interactionScore: true,
        complaintScore:   true,
        revenueScore:     true,
      },
    }),
  ]);

  // ── Build a lookup map: clientId → health data ──────────────────────────
  // `distinct + orderBy desc` above guarantees exactly one (latest) row per
  // clientId, so iterating once into a Map is safe and O(n).
  const healthMap = new Map<string, CustomerHealthData>();
  for (const s of rawScores) {
    const status =
      s.score >= 80 ? "Healthy"
      : s.score >= 60 ? "Stable"
      : s.score >= 40 ? "At Risk"
      : "Critical";

    healthMap.set(s.clientId, {
      score:            s.score,
      status,
      paymentScore:     s.paymentScore,
      engagementScore:  s.engagementScore,
      interactionScore: s.interactionScore,
      complaintScore:   s.complaintScore,
      revenueScore:     s.revenueScore,
    });
  }

  // ── Auto-calculate health for clients with no persisted score ───────────
  // Runs server-side in parallel; awaits persistence so scores are in healthMap.
  const missingIds = rawCustomers
    .filter((c) => !healthMap.has(c.id))
    .map((c) => c.id);

  if (missingIds.length > 0) {
    const results = await Promise.allSettled(
      missingIds.map((id) => calculateHealthScoreFull(id)),
    );
    missingIds.forEach((id, i) => {
      const r = results[i];
      if (r.status === "fulfilled") {
        const { score, status, paymentScore, engagementScore, interactionScore, complaintScore, revenueScore } = r.value;
        healthMap.set(id, { score, status, paymentScore, engagementScore, interactionScore, complaintScore, revenueScore });
      }
    });
  }

  // ── Merge health data into each customer row ─────────────────────────────
  const serialized = serializePrisma(rawCustomers) as unknown as Omit<CustomerRow, "health">[];

  const customers: CustomerRow[] = serialized.map((c) => ({
    ...c,
    health: healthMap.get(c.id) ?? null,
  }));

  // ── Sort: lowest score first (risky customers surface to the top) ────────
  // Customers with no score go to the bottom (treated as score 101 so they
  // don't crowd out confirmed-risky ones).
  customers.sort((a, b) => {
    const sa = a.health?.score ?? 101;
    const sb = b.health?.score ?? 101;
    return sa - sb;
  });

  // ── Stats for the header ─────────────────────────────────────────────────
  const atRiskCount = customers.filter(
    (c) => c.health?.status === "At Risk" || c.health?.status === "Critical",
  ).length;

  const criticalCount  = customers.filter((c) => c.health?.status === "Critical").length;
  const atRiskOnly     = customers.filter((c) => c.health?.status === "At Risk").length;
  const stableCount    = customers.filter((c) => c.health?.status === "Stable").length;
  const healthyCount   = customers.filter((c) => c.health?.status === "Healthy").length;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
            <UserCircle2 className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Customer 360</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              {customers.length} customer{customers.length !== 1 ? "s" : ""}
              {" · "}sorted by health score — click any row to view the full timeline
            </p>
          </div>
        </div>

        {/* Critical alert in header — only shown when there are critical customers */}
        {criticalCount > 0 && (
          <div className="flex shrink-0 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700">
            <AlertTriangle className="h-4 w-4" />
            {criticalCount} critical
          </div>
        )}
      </div>

      {/* Health distribution summary */}
      {customers.some((c) => c.health) && (
        <div className="flex flex-wrap gap-2">
          {healthyCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {healthyCount} Healthy
            </span>
          )}
          {stableCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-xs font-semibold text-yellow-700">
              <span className="h-2 w-2 rounded-full bg-yellow-400" />
              {stableCount} Stable
            </span>
          )}
          {atRiskOnly > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
              <span className="h-2 w-2 rounded-full bg-orange-500" />
              {atRiskOnly} At Risk
            </span>
          )}
          {criticalCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              {criticalCount} Critical
            </span>
          )}
        </div>
      )}

      {/* Table */}
      <CustomersTable customers={customers} atRiskCount={atRiskCount} />
    </div>
  );
}
