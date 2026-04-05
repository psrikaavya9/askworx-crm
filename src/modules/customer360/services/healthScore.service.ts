import { prisma } from "@/lib/prisma";
import type {
  HealthScoreInputs,
  ComponentScores,
  HealthScoreResult,
  HealthStatus,
} from "../types/healthScore.types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * How stale a persisted score can be before recalculation forces a new write.
 * 1 hour covers intra-day data freshness without hammering the DB.
 */
const SCORE_FRESHNESS_MS = 60 * 60 * 1000; // 1 hour

/** Component weights — must sum to 1.0 */
const WEIGHTS = {
  payment:     0.30,
  engagement:  0.25,
  interaction: 0.20,
  complaint:   0.15,
  revenue:     0.10,
} as const;

/** Score thresholds (inclusive lower bound). */
const THRESHOLDS: Array<{ min: number; status: HealthStatus }> = [
  { min: 80, status: "Healthy"  },
  { min: 60, status: "Stable"   },
  { min: 40, status: "At Risk"  },
  { min:  0, status: "Critical" },
];

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function daysSince(date: Date, now = new Date()): number {
  return (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
}

// ---------------------------------------------------------------------------
// Pure scorer functions  (all accept pre-fetched slices of HealthScoreInputs)
// ---------------------------------------------------------------------------

/**
 * PAYMENT SCORE  — 30%
 *
 * Rewards high collection rates; penalises overdue invoices.
 * No invoice history → neutral (50) to avoid unfair penalties for new clients.
 *
 * Components:
 *   collection rate (0–80 pts)  = totalPaid / totalInvoiced × 80
 *   overdue penalty  (−15 per)   capped at −40
 */
function scorePayment(inputs: Pick<HealthScoreInputs, "invoices" | "payments">): number {
  const { invoices, payments } = inputs;

  if (invoices.length === 0) return 50; // no history → neutral

  const totalInvoiced = invoices.reduce((s, i) => s + i.totalAmount, 0);
  const totalPaid     = payments.reduce((s, p) => s + p.amount, 0);
  const overdueCount  = invoices.filter((i) => i.status === "OVERDUE").length;

  const collectionRate  = totalInvoiced > 0 ? totalPaid / totalInvoiced : 0;
  const collectionScore = collectionRate * 80;                       // max 80
  const overduePenalty  = Math.min(40, overdueCount * 15);

  return clamp(collectionScore - overduePenalty);
}

/**
 * ENGAGEMENT SCORE  — 25%
 *
 * Measures how recently and how often the client has been contacted.
 * Recency is the dominant signal; frequency adds a bonus.
 *
 * Recency bands:
 *   ≤  7 days → 100 pts
 *   ≤ 14 days →  85 pts
 *   ≤ 30 days →  70 pts
 *   ≤ 60 days →  45 pts
 *   ≤ 90 days →  20 pts
 *    > 90 days →   0 pts
 *
 * Frequency bonus: +3 per interaction in last 30 days, capped at +15.
 */
function scoreEngagement(
  inputs: Pick<HealthScoreInputs, "interactions">,
  now    = new Date(),
): number {
  const { interactions } = inputs;

  if (interactions.length === 0) return 0;

  const dates   = interactions.map((i) => i.date);
  const latest  = new Date(Math.max(...dates.map((d) => d.getTime())));
  const daysSinceLast = daysSince(latest, now);

  let recencyScore: number;
  if      (daysSinceLast <=  7) recencyScore = 100;
  else if (daysSinceLast <= 14) recencyScore =  85;
  else if (daysSinceLast <= 30) recencyScore =  70;
  else if (daysSinceLast <= 60) recencyScore =  45;
  else if (daysSinceLast <= 90) recencyScore =  20;
  else                          recencyScore =   0;

  const cutoff30      = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const last30Count   = interactions.filter((i) => i.date >= cutoff30).length;
  const frequencyBonus = Math.min(15, last30Count * 3);

  return clamp(recencyScore + frequencyBonus);
}

/**
 * INTERACTION SCORE  — 20%
 *
 * Measures quality of interaction history: volume, type diversity,
 * and owner-approval rate.
 *
 * Volume    (0–40): interactions in last 90 days × 8, diminishing after 5
 * Diversity (0–20): unique types used (CALL / VISIT / NOTE)
 * Approval  (0–40): approved / total × 40
 */
function scoreInteraction(
  inputs: Pick<HealthScoreInputs, "interactions">,
  now    = new Date(),
): number {
  const { interactions } = inputs;

  if (interactions.length === 0) return 0;

  const cutoff90    = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const recent      = interactions.filter((i) => i.date >= cutoff90);
  const volumeScore = Math.min(40, recent.length * 8);

  const typesUsed      = new Set(interactions.map((i) => i.type));
  const diversityScore = typesUsed.size === 3 ? 20 : typesUsed.size === 2 ? 12 : 5;

  const approvedCount  = interactions.filter((i) => i.approved).length;
  const approvalScore  = Math.round((approvedCount / interactions.length) * 40);

  return clamp(volumeScore + diversityScore + approvalScore);
}

/**
 * COMPLAINT SCORE  — 15%
 *
 * Inverse scoring: fewer and less severe unresolved complaints → higher score.
 * No complaints → perfect (100).
 *
 * Start at 100; deduct:
 *   −20 per OPEN complaint
 *   −10 per IN_PROGRESS complaint
 *   −20 per CRITICAL open/in-progress complaint (stacks with above)
 * Add:
 *   +10 bonus if ≥ 80% of complaints are resolved/closed
 */
function scoreComplaint(inputs: Pick<HealthScoreInputs, "complaints">): number {
  const { complaints } = inputs;

  if (complaints.length === 0) return 100;

  let score = 100;

  for (const c of complaints) {
    const isOpen       = c.status === "OPEN";
    const isInProgress = c.status === "IN_PROGRESS";
    const isCritical   = c.priority === "CRITICAL";

    if (isOpen)       score -= 20;
    if (isInProgress) score -= 10;
    if (isCritical && (isOpen || isInProgress)) score -= 20; // stacks
  }

  const resolvedCount = complaints.filter(
    (c) => c.status === "RESOLVED" || c.status === "CLOSED",
  ).length;
  if (resolvedCount / complaints.length >= 0.8) score += 10;

  return clamp(score);
}

/**
 * REVENUE SCORE  — 10%
 *
 * Tiered scoring based on cumulative paid revenue (INR).
 * Avoids the need for a global benchmark — rewards absolute relationship value.
 *
 *   ₹0              →  10
 *   ₹1 – ₹50,000    →  25
 *   ₹50k – ₹2L      →  45
 *   ₹2L  – ₹5L      →  65
 *   ₹5L  – ₹20L     →  80
 *   ₹20L+           → 100
 */
function scoreRevenue(inputs: Pick<HealthScoreInputs, "payments">): number {
  const { payments } = inputs;

  const totalRevenue = payments.reduce((s, p) => s + p.amount, 0);

  if (totalRevenue <= 0)         return 10;
  if (totalRevenue < 50_000)     return 25;
  if (totalRevenue < 200_000)    return 45;
  if (totalRevenue < 500_000)    return 65;
  if (totalRevenue < 2_000_000)  return 80;
  return 100;
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

function deriveStatus(score: number): HealthStatus {
  return (THRESHOLDS.find((t) => score >= t.min) ?? THRESHOLDS.at(-1)!).status;
}

/**
 * Each component is independently clamped before weighting.
 * Without this, an overflow in one scorer (e.g. engagement = 115) would silently
 * skew the composite score upward even though aggregate() clamps the final value.
 */
function clampComponents(c: ComponentScores): ComponentScores {
  return {
    payment:     clamp(c.payment),
    engagement:  clamp(c.engagement),
    interaction: clamp(c.interaction),
    complaint:   clamp(c.complaint),
    revenue:     clamp(c.revenue),
  };
}

function aggregate(components: ComponentScores): number {
  const c = clampComponents(components);
  return clamp(
    c.payment     * WEIGHTS.payment     +
    c.engagement  * WEIGHTS.engagement  +
    c.interaction * WEIGHTS.interaction +
    c.complaint   * WEIGHTS.complaint   +
    c.revenue     * WEIGHTS.revenue,
  );
}

// ---------------------------------------------------------------------------
// Data fetcher — single parallel round-trip
// ---------------------------------------------------------------------------

async function fetchInputs(clientId: string): Promise<HealthScoreInputs> {
  // Caps prevent pathological load on clients with thousands of records.
  // Scorers are statistical — 500 recent interactions produce the same signal
  // as 5,000, so precision loss is negligible.
  const [rawInvoices, rawInteractions, rawComplaints] = await Promise.all([
    prisma.invoice.findMany({
      where:   { clientId },
      orderBy: { issueDate: "desc" },
      take:    200,                    // last 200 invoices ≈ 5+ years of monthly billing
      select: {
        status:      true,
        totalAmount: true,
        payments: {
          select: { amount: true, paymentDate: true },
        },
      },
    }),
    prisma.customerInteraction.findMany({
      where:   { clientId },
      orderBy: { date: "desc" },
      take:    500,                    // last 500 interactions
      select:  { date: true, type: true, approved: true },
    }),
    prisma.complaint.findMany({
      where:  { clientId },
      select: { status: true, priority: true },
      // No take — complaint totals must be accurate; complaints rarely exceed 100
    }),
  ]);

  // Flatten payments out of invoices
  const invoices: HealthScoreInputs["invoices"] = rawInvoices.map((i) => ({
    status:      i.status,
    totalAmount: Number(i.totalAmount),
  }));

  const payments: HealthScoreInputs["payments"] = rawInvoices.flatMap((i) =>
    i.payments.map((p) => ({
      amount:      Number(p.amount),
      paymentDate: p.paymentDate,
    })),
  );

  return { invoices, payments, interactions: rawInteractions, complaints: rawComplaints };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Calculates a Customer Health Score from 0–100 using five weighted components.
 *
 * Weights: Payment 30% · Engagement 25% · Interaction 20% · Complaint 15% · Revenue 10%
 * Status:  Healthy (80–100) · Stable (60–79) · At Risk (40–59) · Critical (<40)
 *
 * The result is persisted to CustomerHealthScore so the Customer 360 page can
 * display the latest score without recalculating on every page load.
 *
 * @param clientId  Prisma Client.id
 * @param persist   Set to false to skip the DB write (useful for previews)
 */
export async function calculateHealthScore(
  clientId: string,
  persist  = true,
): Promise<HealthScoreResult> {
  // Validate client exists
  const client = await prisma.client.findUnique({
    where:  { id: clientId },
    select: { id: true },
  });
  if (!client) throw new Error(`Client not found: ${clientId}`);

  // Fetch all inputs in one parallel round-trip
  const inputs = await fetchInputs(clientId);

  // Run all five scorers (synchronous pure functions)
  const components: ComponentScores = {
    payment:     scorePayment    (inputs),
    engagement:  scoreEngagement (inputs),
    interaction: scoreInteraction(inputs),
    complaint:   scoreComplaint  (inputs),
    revenue:     scoreRevenue    (inputs),
  };

  const score  = aggregate(components);
  const status = deriveStatus(score);

  // Persist the result — but only when the existing score is stale.
  // This prevents duplicate writes when multiple users trigger recalculation
  // within the same hour (common when the C360 page auto-triggers on load).
  if (persist) {
    const latest = await prisma.customerHealthScore.findFirst({
      where:   { clientId },
      orderBy: { calculatedAt: "desc" },
      select:  { calculatedAt: true },
    });

    const isStale =
      !latest ||
      Date.now() - latest.calculatedAt.getTime() > SCORE_FRESHNESS_MS;

    if (!isStale) {
      return { score, status, components: clampComponents(components) };
    }

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

  return { score, status, components: clampComponents(components) };
}
