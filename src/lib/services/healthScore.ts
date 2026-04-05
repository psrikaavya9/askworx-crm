/**
 * lib/services/healthScore.ts
 *
 * Self-contained Customer Health Score service.
 *
 * Uses five lean aggregate queries (no full-row fetches) in a single
 * parallel round-trip to score five business dimensions, then combines
 * them into a weighted composite 0–100.
 *
 * Scoring weights (must sum to 1.0)
 * ───────────────────────────────────────────────────────────────────────────
 *  Payment     30%   overdue invoice ratio
 *  Engagement  25%   active project count
 *  Interaction 20%   days since last approved interaction
 *  Complaint   15%   open / in-progress complaint count  (inverse)
 *  Revenue     10%   total billed amount  (tiered)
 *
 * Status thresholds
 * ───────────────────────────────────────────────────────────────────────────
 *  ≥ 80  →  Healthy
 *  60–79 →  Stable
 *  40–59 →  At Risk
 *   < 40 →  Critical
 */

import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type HealthStatus = "Healthy" | "Stable" | "At Risk" | "Critical";

export interface HealthScoreOutput {
  score:  number;   // 0–100 composite
  status: HealthStatus;
}

// ---------------------------------------------------------------------------
// Internal input shape (populated by fetchInputs)
// ---------------------------------------------------------------------------

interface ScoreInputs {
  totalInvoices:          number;
  overdueInvoices:        number;
  activeProjects:         number;
  latestInteractionDate:  Date | null;
  openComplaints:         number;
  totalBilling:           number;   // sum of all invoice totalAmount
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WEIGHTS = {
  payment:     0.30,
  engagement:  0.25,
  interaction: 0.20,
  complaint:   0.15,
  revenue:     0.10,
} as const;

/** Staleness guard — skip DB write if score was persisted less than 1 h ago. */
const FRESHNESS_MS = 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clamp to integer in [0, 100]. */
function clamp(v: number): number {
  return Math.min(100, Math.max(0, Math.round(v)));
}

function deriveStatus(score: number): HealthStatus {
  if (score >= 80) return "Healthy";
  if (score >= 60) return "Stable";
  if (score >= 40) return "At Risk";
  return "Critical";
}

// ---------------------------------------------------------------------------
// Component scorers — pure functions, no I/O
// ---------------------------------------------------------------------------

/**
 * PAYMENT SCORE  (30%)
 *
 * Measures collection health via the ratio of overdue invoices to total
 * invoices. No invoice history → neutral 50 (new clients should not start
 * penalised).
 *
 * Overdue ratio  →  Score
 *    0 %         →  100
 *  1–10 %        →   80
 * 11–25 %        →   60
 * 26–50 %        →   35
 *  > 50 %        →   10
 */
function scorePayment(total: number, overdue: number): number {
  if (total === 0) return 50;

  const ratio = overdue / total;

  if (ratio === 0)    return 100;
  if (ratio <= 0.10)  return 80;
  if (ratio <= 0.25)  return 60;
  if (ratio <= 0.50)  return 35;
  return 10;
}

/**
 * ENGAGEMENT SCORE  (25%)
 *
 * Active projects are the strongest signal of ongoing business engagement.
 * A client with zero active projects may be in a lull or at churn risk.
 *
 * Active projects  →  Score
 *       0          →   10
 *       1          →   65
 *       2          →   85
 *      3+          →  100
 */
function scoreEngagement(activeProjects: number): number {
  if (activeProjects === 0) return 10;
  if (activeProjects === 1) return 65;
  if (activeProjects === 2) return 85;
  return 100;
}

/**
 * INTERACTION SCORE  (20%)
 *
 * How recently an approved interaction (call, visit, or note) was logged.
 * Recency within 30 days is the threshold for "active contact".
 *
 * Days since last interaction  →  Score
 *   No interactions            →    0
 *       ≤  7 days              →  100
 *       ≤ 14 days              →   85
 *       ≤ 30 days              →   70
 *       ≤ 60 days              →   40
 *       ≤ 90 days              →   20
 *        > 90 days             →    0
 */
function scoreInteraction(latestDate: Date | null): number {
  if (!latestDate) return 0;

  const days = (Date.now() - latestDate.getTime()) / (1000 * 60 * 60 * 24);

  if (days <=  7) return 100;
  if (days <= 14) return  85;
  if (days <= 30) return  70;
  if (days <= 60) return  40;
  if (days <= 90) return  20;
  return 0;
}

/**
 * COMPLAINT SCORE  (15%)
 *
 * Inverse scoring — open or in-progress complaints signal dissatisfaction.
 * No unresolved complaints → perfect 100.
 *
 * Open complaints  →  Score
 *        0         →  100
 *        1         →   65
 *        2         →   40
 *        3         →   20
 *       4+         →    0
 */
function scoreComplaint(openCount: number): number {
  if (openCount === 0) return 100;
  if (openCount === 1) return  65;
  if (openCount === 2) return  40;
  if (openCount === 3) return  20;
  return 0;
}

/**
 * REVENUE SCORE  (10%)
 *
 * Absolute total billing (INR). Rewards depth of financial relationship
 * without requiring a global benchmark.
 *
 * Total billing    →  Score
 *   ₹0             →   10
 *   < ₹50k         →   25
 *   < ₹2L          →   45
 *   < ₹5L          →   65
 *   < ₹20L         →   80
 *   ₹20L+          →  100
 */
function scoreRevenue(totalBilling: number): number {
  if (totalBilling <= 0)         return 10;
  if (totalBilling < 50_000)     return 25;
  if (totalBilling < 200_000)    return 45;
  if (totalBilling < 500_000)    return 65;
  if (totalBilling < 2_000_000)  return 80;
  return 100;
}

// ---------------------------------------------------------------------------
// Data fetcher — 6 parallel queries, all aggregates or single-row reads
// ---------------------------------------------------------------------------

async function fetchInputs(clientId: string): Promise<ScoreInputs> {
  const [
    totalInvoices,
    overdueInvoices,
    activeProjects,
    latestInteraction,
    openComplaints,
    billingAgg,
  ] = await Promise.all([
    // Total invoice count
    prisma.invoice.count({
      where: { clientId },
    }),

    // Overdue invoice count
    prisma.invoice.count({
      where: { clientId, status: "OVERDUE" },
    }),

    // Active project count
    prisma.project.count({
      where: { clientId, status: "ACTIVE" },
    }),

    // Most recent approved interaction (date only)
    prisma.customerInteraction.findFirst({
      where:   { clientId, approved: true, rejected: false },
      orderBy: { date: "desc" },
      select:  { date: true },
    }),

    // Open + in-progress complaint count
    prisma.complaint.count({
      where: {
        clientId,
        status: { in: ["OPEN", "IN_PROGRESS"] },
      },
    }),

    // Total billed — sum of all invoice amounts
    prisma.invoice.aggregate({
      where: { clientId },
      _sum:  { totalAmount: true },
    }),
  ]);

  return {
    totalInvoices,
    overdueInvoices,
    activeProjects,
    latestInteractionDate: latestInteraction?.date ?? null,
    openComplaints,
    totalBilling: Number(billingAgg._sum.totalAmount ?? 0),
  };
}

// ---------------------------------------------------------------------------
// Weighted aggregate
// ---------------------------------------------------------------------------

interface ComponentScores {
  payment:     number;
  engagement:  number;
  interaction: number;
  complaint:   number;
  revenue:     number;
}

function aggregate(c: ComponentScores): number {
  return clamp(
    c.payment     * WEIGHTS.payment     +
    c.engagement  * WEIGHTS.engagement  +
    c.interaction * WEIGHTS.interaction +
    c.complaint   * WEIGHTS.complaint   +
    c.revenue     * WEIGHTS.revenue,
  );
}

// ---------------------------------------------------------------------------
// Core calculation (shared by public exports)
// ---------------------------------------------------------------------------

async function compute(
  clientId: string,
): Promise<{ score: number; status: HealthStatus; components: ComponentScores }> {
  const inputs = await fetchInputs(clientId);

  const components: ComponentScores = {
    payment:     clamp(scorePayment    (inputs.totalInvoices, inputs.overdueInvoices)),
    engagement:  clamp(scoreEngagement (inputs.activeProjects)),
    interaction: clamp(scoreInteraction(inputs.latestInteractionDate)),
    complaint:   clamp(scoreComplaint  (inputs.openComplaints)),
    revenue:     clamp(scoreRevenue    (inputs.totalBilling)),
  };

  const score  = aggregate(components);
  const status = deriveStatus(score);

  console.log(
    `[healthScore] clientId=${clientId} | score=${score} (${status})` +
    ` | payment=${components.payment} engagement=${components.engagement}` +
    ` | interaction=${components.interaction} complaint=${components.complaint}` +
    ` | revenue=${components.revenue}`,
  );

  return { score, status, components };
}

// ---------------------------------------------------------------------------
// Persistence helper
// ---------------------------------------------------------------------------

async function persist(
  clientId: string,
  score:      number,
  components: ComponentScores,
): Promise<void> {
  // Skip write if a fresh score already exists (prevents duplicate rows when
  // multiple page loads trigger recalculation within the same hour).
  const latest = await prisma.customerHealthScore.findFirst({
    where:   { clientId },
    orderBy: { calculatedAt: "desc" },
    select:  { calculatedAt: true },
  });

  const isStale =
    !latest ||
    Date.now() - latest.calculatedAt.getTime() > FRESHNESS_MS;

  if (!isStale) return;

  await prisma.customerHealthScore.create({
    data: {
      clientId,
      score,
      paymentScore:     components.payment,
      engagementScore:  components.engagement,
      interactionScore: components.interaction,
      complaintScore:   components.complaint,
      revenueScore:     components.revenue,
    },
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Calculates the Customer Health Score from live database data.
 *
 * Runs six aggregate queries in parallel — no full-row fetches.
 * Persists the result to `CustomerHealthScore` (skipped if score is < 1 h old).
 *
 * @param clientId  Prisma `Client.id`
 * @returns         `{ score, status }` — score is 0–100, status is the tier label
 *
 * @example
 *   const { score, status } = await calculateHealthScore(client.id)
 *   // score  → 74
 *   // status → "Stable"
 */
export async function calculateHealthScore(
  clientId: string,
): Promise<HealthScoreOutput> {
  const { score, status, components } = await compute(clientId);

  // Fire-and-forget persistence — page render should not wait on the write
  persist(clientId, score, components).catch((err) =>
    console.error(`[healthScore] persist failed for ${clientId}:`, err),
  );

  return { score, status };
}

/**
 * Same as `calculateHealthScore` but skips the DB write.
 * Safe for previews, dry-runs, and tests.
 */
export async function previewHealthScore(
  clientId: string,
): Promise<HealthScoreOutput> {
  const { score, status } = await compute(clientId);
  return { score, status };
}
