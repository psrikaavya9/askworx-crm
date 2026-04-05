import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Score weights (total: 100)
// ---------------------------------------------------------------------------

const MAX_COMPANY_SIZE = 20;
const MAX_INDUSTRY     = 15;
const MAX_SOURCE       = 15;
const MAX_RECENCY      = 25;
const MAX_ENGAGEMENT   = 25;

// ---------------------------------------------------------------------------
// Factor tables
// ---------------------------------------------------------------------------

const COMPANY_SIZE_SCORES: Record<string, number> = {
  ENTERPRISE: 20,
  LARGE:      15,
  MEDIUM:     10,
  SMALL:       5,
};

const INDUSTRY_SCORES: Record<string, number> = {
  TECHNOLOGY:    15,
  FINANCE:       15,
  HEALTHCARE:    15,
  RETAIL:        10,
  MANUFACTURING: 10,
  EDUCATION:     10,
  REAL_ESTATE:   10,
  GOVERNMENT:     7,
  NON_PROFIT:     7,
};

const SOURCE_SCORES: Record<string, number> = {
  REFERRAL:       15,
  PARTNER:        15,
  WEBSITE:        12,
  TRADE_SHOW:     12,
  SOCIAL_MEDIA:    8,
  EMAIL_CAMPAIGN:  8,
  COLD_CALL:       5,
  OTHER:           3,
};

// Engagement-contributing activity types
const ENGAGEMENT_TYPES = new Set([
  "CALL_MADE",
  "MEETING_HELD",
  "EMAIL_SENT",
  "MEETING_SCHEDULED",
  "PROPOSAL_SENT",
]);

// ---------------------------------------------------------------------------
// Factor calculators
// ---------------------------------------------------------------------------

function companySizeScore(size: string | null): number {
  if (!size) return 5; // default: treat as SMALL
  return COMPANY_SIZE_SCORES[size] ?? 5;
}

function industryScore(industry: string | null): number {
  if (!industry) return 5;
  return INDUSTRY_SCORES[industry.toUpperCase()] ?? 5;
}

function sourceScore(source: string): number {
  return SOURCE_SCORES[source] ?? 3;
}

function recencyScore(lastActivityAt: Date | null, createdAt: Date): number {
  const ref = lastActivityAt ?? createdAt;
  const days = (Date.now() - ref.getTime()) / 86_400_000;
  if (days < 3)  return MAX_RECENCY;       // 25 — active this week
  if (days < 7)  return 18;
  if (days < 30) return 10;
  return 3;                                 // stale
}

function engagementScore(interactionCount: number): number {
  if (interactionCount === 0)  return 0;
  if (interactionCount <= 2)   return 8;
  if (interactionCount <= 5)   return 15;
  if (interactionCount <= 10)  return 20;
  return MAX_ENGAGEMENT;                    // 25 — highly engaged
}

function deriveCategory(total: number): "HOT" | "WARM" | "COLD" {
  if (total >= 80) return "HOT";
  if (total >= 50) return "WARM";
  return "COLD";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ScoreBreakdown {
  companySizeScore: number;
  industryScore:    number;
  sourceScore:      number;
  recencyScore:     number;
  engagementScore:  number;
  totalScore:       number;
  category:         "HOT" | "WARM" | "COLD";
}

/**
 * Computes the lead score and upserts it into LeadScore table.
 * Safe to call fire-and-forget (errors are swallowed with a console.error).
 */
export async function computeAndSave(leadId: string): Promise<ScoreBreakdown> {
  const lead = await prisma.lead.findUniqueOrThrow({
    where: { id: leadId },
    include: {
      activities: {
        orderBy: { createdAt: "desc" },
        take: 100,
      },
    },
  });

  // Latest activity timestamp for recency
  const lastActivity = lead.activities[0]?.createdAt ?? null;

  // Count meaningful engagement interactions
  const interactions = lead.activities.filter((a) =>
    ENGAGEMENT_TYPES.has(a.type)
  ).length;

  const cs = companySizeScore(lead.companySize ?? null);
  const is = industryScore(lead.industry ?? null);
  const ss = sourceScore(lead.source);
  const rs = recencyScore(lastActivity, lead.createdAt);
  const es = engagementScore(interactions);

  const total = cs + is + ss + rs + es;
  const category = deriveCategory(total);

  // Upsert into LeadScore table
  await prisma.leadScore.upsert({
    where:  { leadId },
    create: {
      leadId,
      companySizeScore: cs,
      industryScore:    is,
      sourceScore:      ss,
      recencyScore:     rs,
      engagementScore:  es,
      totalScore:       total,
      category,
      calculatedAt:     new Date(),
    },
    update: {
      companySizeScore: cs,
      industryScore:    is,
      sourceScore:      ss,
      recencyScore:     rs,
      engagementScore:  es,
      totalScore:       total,
      category,
      calculatedAt:     new Date(),
    },
  });

  return { companySizeScore: cs, industryScore: is, sourceScore: ss, recencyScore: rs, engagementScore: es, totalScore: total, category };
}

/**
 * Fire-and-forget wrapper — call this from other services to avoid blocking.
 */
export function scheduleScore(leadId: string): void {
  computeAndSave(leadId).catch((err) =>
    console.error(`[scoring] Failed to score lead ${leadId}:`, err)
  );
}
