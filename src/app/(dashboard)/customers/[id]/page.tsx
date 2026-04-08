import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { serializePrisma } from "@/lib/serialize";
import { getCustomerTimeline } from "@/modules/customer360/services/timeline.service";
import { calculateHealthScore } from "@/lib/services/healthScore";
import { Customer360Client } from "@/components/customer360/Customer360Client";
import { HealthScoreCard } from "@/components/customer/HealthScoreCard";
import { ActivityTimeline } from "@/components/customer360/ActivityTimeline";
import type {
  C360Client,
  C360Interaction,
  C360Project,
  C360Invoice,
  C360Complaint,
  C360HealthScore,
} from "@/components/customer360/types";
import type { TimelineEvent } from "@/modules/customer360/types/timeline.types";

// ---------------------------------------------------------------------------
// Page-level limits — keep initial load fast; users can drill into tabs
// ---------------------------------------------------------------------------

const LIMITS = {
  interactions: 50,   // timeline shows latest 50; older events lazy-loaded
  projects:     30,
  invoices:     50,
  complaints:   50,
} as const;

// ---------------------------------------------------------------------------
// Cached data fetcher
//
// unstable_cache gives us Next.js data-layer caching with tag-based invalidation.
//   - TTL: 60 seconds (handles rapid navigation between client profiles)
//   - Tags: ["c360", `c360-${id}`] — tagged invalidation when mutations occur
//
// Any route handler that creates/updates an interaction, invoice, complaint,
// or project for this client should call:
//   revalidateTag(`c360-${clientId}`)
// ---------------------------------------------------------------------------

// Plain async function — NOT wrapped in unstable_cache here.
// Single-layer caching is applied per-client in the page component below.
// Double-wrapping caused the inner cache to hold stale data even after
// revalidateTag("c360-${id}") was called, because the inner layer only
// had the broad "c360" tag and ignored per-client invalidation.
async function fetchC360Data(id: string) {
  const [client, interactions, projects, invoices, complaints, healthScore, timeline, health] =
    await Promise.all([
      prisma.client.findUnique({
        where: { id },
        include: {
          leads: {
            orderBy: { createdAt: "desc" },
            take:    5,
            select: {
              id:        true,
              source:    true,
              stage:     true,
              dealValue: true,
              createdAt: true,
            },
          },
        },
      }),

      prisma.customerInteraction.findMany({
        where:   { clientId: id },
        orderBy: { date: "desc" },
        take:    LIMITS.interactions,
        include: {
          staff: {
            select: { firstName: true, lastName: true, department: true },
          },
        },
      }),

      prisma.project.findMany({
        where:   { clientId: id },
        orderBy: { createdAt: "desc" },
        take:    LIMITS.projects,
        include: { _count: { select: { tasks: true } } },
      }),

      prisma.invoice.findMany({
        where:   { clientId: id },
        orderBy: { issueDate: "desc" },
        take:    LIMITS.invoices,
        include: { payments: { select: { amount: true } } },
      }),

      prisma.complaint.findMany({
        where:   { clientId: id },
        orderBy: { createdAt: "desc" },
        take:    LIMITS.complaints,
      }),

      // Latest persisted health score — recalculated by POST /api/customers/:id/health-score
      prisma.customerHealthScore.findFirst({
        where:   { clientId: id },
        orderBy: { calculatedAt: "desc" },
      }),

      // Unified timeline — all 5 sources merged and sorted latest-first
      getCustomerTimeline(id),

      // Live health score — recalculates if the persisted score is > 1 h stale
      calculateHealthScore(id).catch(() => null),
    ]);

  console.log(`[C360] clientId=${id} | timeline events=${timeline.length} | interactions(raw)=${interactions.length} | health=${health?.score ?? "—"}`);

  return { client, interactions, projects, invoices, complaints, healthScore, timeline, health };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type Props = { params: Promise<{ id: string }> };

export default async function Customer360Page({ params }: Props) {
  const { id } = await params;

  // Single cache layer — per-client key, per-client + broad tags.
  // revalidateTag("c360-${id}") busts exactly this client.
  // revalidateTag("c360")       busts all clients (e.g. after bulk ops).
  const getCachedData = unstable_cache(
    () => fetchC360Data(id),
    [`c360-${id}`],
    { revalidate: 60, tags: [`c360-${id}`, "c360"] },
  );

  const { client, interactions, projects, invoices, complaints, healthScore, timeline, health } =
    await getCachedData();

  console.log(`[C360 page] clientId=${id} | rendering with ${timeline.length} timeline events | health=${health?.score ?? "—"}`);

  if (!client) notFound();

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-6">
      <Link
        href="/crm/clients"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        All Clients
      </Link>

      <HealthScoreCard
        score={health?.score ?? null}
        status={health?.status ?? null}
        breakdown={
          healthScore
            ? {
                paymentScore:     healthScore.paymentScore,
                engagementScore:  healthScore.engagementScore,
                interactionScore: healthScore.interactionScore,
                complaintScore:   healthScore.complaintScore,
                revenueScore:     healthScore.revenueScore,
              }
            : undefined
        }
      />

      <Customer360Client
        client={serializePrisma(client) as unknown as C360Client}
        interactions={serializePrisma(interactions) as unknown as C360Interaction[]}
        projects={serializePrisma(projects) as unknown as C360Project[]}
        invoices={serializePrisma(invoices) as unknown as C360Invoice[]}
        complaints={serializePrisma(complaints) as unknown as C360Complaint[]}
        healthScore={
          healthScore
            ? (serializePrisma(healthScore) as unknown as C360HealthScore)
            : null
        }
        timeline={timeline as TimelineEvent[]}
      />

      {/* Always-visible unified timeline strip — full history lives in the Timeline tab above */}
      <ActivityTimeline timeline={timeline as TimelineEvent[]} />
    </div>
  );
}
