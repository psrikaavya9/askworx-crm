/**
 * scripts/backfill-scores.ts
 *
 * Calculates and upserts a LeadScore for every lead that doesn't have one yet.
 * Run once: npx tsx scripts/backfill-scores.ts
 */

import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const pool    = new Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma  = new (PrismaClient as any)({ adapter }) as PrismaClient;

// ---------------------------------------------------------------------------
// Scoring tables (mirrors scoring.service.ts)
// ---------------------------------------------------------------------------

const COMPANY_SIZE_SCORES: Record<string, number> = {
  ENTERPRISE: 20, LARGE: 15, MEDIUM: 10, SMALL: 5,
};

const SOURCE_SCORES: Record<string, number> = {
  REFERRAL: 15, PARTNER: 15, WEBSITE: 12, TRADE_SHOW: 12,
  SOCIAL_MEDIA: 8, EMAIL_CAMPAIGN: 8, COLD_CALL: 5, OTHER: 3,
};

const INDUSTRY_SCORES: Record<string, number> = {
  TECHNOLOGY: 15, FINANCE: 15, HEALTHCARE: 15,
  RETAIL: 10, MANUFACTURING: 10, EDUCATION: 10, REAL_ESTATE: 10,
  GOVERNMENT: 7, NON_PROFIT: 7,
};

const ENGAGEMENT_TYPES = new Set([
  "CALL_MADE", "MEETING_HELD", "EMAIL_SENT", "MEETING_SCHEDULED", "PROPOSAL_SENT",
]);

function deriveCategory(total: number): "HOT" | "WARM" | "COLD" {
  if (total >= 80) return "HOT";
  if (total >= 50) return "WARM";
  return "COLD";
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("🔢 Backfilling lead scores...\n");

  // Fetch all leads without a score
  const leads = await prisma.lead.findMany({
    where:   { score: { is: null } },
    include: {
      activities: { orderBy: { createdAt: "desc" }, take: 100 },
    },
  });

  console.log(`Found ${leads.length} unscored leads`);
  if (leads.length === 0) {
    console.log("✅ Nothing to do.");
    return;
  }

  let done = 0;
  let failed = 0;

  for (const lead of leads) {
    try {
      const lastActivity = lead.activities[0]?.createdAt ?? null;
      const refDate = lastActivity ?? lead.createdAt;
      const daysSince = (Date.now() - refDate.getTime()) / 86_400_000;

      const cs = COMPANY_SIZE_SCORES[lead.companySize ?? ""] ?? 5;
      const is = INDUSTRY_SCORES[(lead.industry ?? "").toUpperCase()] ?? 5;
      const ss = SOURCE_SCORES[lead.source] ?? 3;

      let rs: number;
      if (daysSince < 3)  rs = 25;
      else if (daysSince < 7)  rs = 18;
      else if (daysSince < 30) rs = 10;
      else rs = 3;

      const interactionCount = lead.activities.filter((a) => ENGAGEMENT_TYPES.has(a.type)).length;
      let es: number;
      if (interactionCount === 0)       es = 0;
      else if (interactionCount <= 2)   es = 8;
      else if (interactionCount <= 5)   es = 15;
      else if (interactionCount <= 10)  es = 20;
      else es = 25;

      const total    = cs + is + ss + rs + es;
      const category = deriveCategory(total);

      await prisma.leadScore.upsert({
        where:  { leadId: lead.id },
        create: { leadId: lead.id, companySizeScore: cs, industryScore: is, sourceScore: ss, recencyScore: rs, engagementScore: es, totalScore: total, category },
        update: { companySizeScore: cs, industryScore: is, sourceScore: ss, recencyScore: rs, engagementScore: es, totalScore: total, category, calculatedAt: new Date() },
      });

      done++;
      if (done % 25 === 0) process.stdout.write(`  ${done}/${leads.length}\n`);
    } catch (err) {
      console.error(`  ❌ lead ${lead.id}:`, (err as Error).message);
      failed++;
    }
  }

  console.log(`\n✅ Backfill complete: ${done} scored, ${failed} failed`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect().then(() => pool.end()));
