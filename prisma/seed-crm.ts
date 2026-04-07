/**
 * seed-crm.ts
 *
 * Idempotent CRM intelligence seed:
 *   1. 18 leads spread across all 6 pipeline stages
 *   2. Rich activity histories per lead (CALL_MADE, EMAIL_SENT, MEETING_HELD, etc.)
 *      → drives engagement-score component so HOT / WARM / COLD scores are realistic
 *   3. Lead scores computed and persisted for every lead
 *   4. CustomerInteraction records linked to WON clients
 *   5. FollowUpReminders for active leads (pending + overdue)
 *
 * Run: npx tsx --tsconfig tsconfig.seed.json prisma/seed-crm.ts
 */

import "dotenv/config";
import { Pool }      from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const pool    = new Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma  = new (PrismaClient as any)({ adapter }) as PrismaClient;

const daysAgo   = (n: number) => new Date(Date.now() - n * 86_400_000);
const daysAhead = (n: number) => new Date(Date.now() + n * 86_400_000);

// ---------------------------------------------------------------------------
// Score computation (mirrors scoring.service.ts — inline to share prisma instance)
// ---------------------------------------------------------------------------

const COMPANY_SIZE_SCORES: Record<string, number> = { ENTERPRISE: 20, LARGE: 15, MEDIUM: 10, SMALL: 5 };
const INDUSTRY_SCORES:     Record<string, number> = {
  TECHNOLOGY: 15, FINANCE: 15, HEALTHCARE: 15,
  RETAIL: 10, MANUFACTURING: 10, EDUCATION: 10, REAL_ESTATE: 10,
  GOVERNMENT: 7, NON_PROFIT: 7,
};
const SOURCE_SCORES: Record<string, number> = {
  REFERRAL: 15, PARTNER: 15, WEBSITE: 12, TRADE_SHOW: 12,
  SOCIAL_MEDIA: 8, EMAIL_CAMPAIGN: 8, COLD_CALL: 5, OTHER: 3,
};
const ENGAGEMENT_TYPES = new Set(["CALL_MADE","MEETING_HELD","EMAIL_SENT","MEETING_SCHEDULED","PROPOSAL_SENT"]);

async function computeAndSaveScore(leadId: string) {
  const lead = await prisma.lead.findUniqueOrThrow({
    where: { id: leadId },
    include: { activities: { orderBy: { createdAt: "desc" }, take: 100 } },
  });

  const lastActivity  = lead.activities[0]?.createdAt ?? null;
  const interactions  = lead.activities.filter((a: { type: string }) => ENGAGEMENT_TYPES.has(a.type)).length;

  const cs = COMPANY_SIZE_SCORES[lead.companySize ?? ""] ?? 5;
  const is = INDUSTRY_SCORES[(lead.industry ?? "").toUpperCase()] ?? 5;
  const ss = SOURCE_SCORES[lead.source] ?? 3;

  const ref  = lastActivity ?? lead.createdAt;
  const days = (Date.now() - ref.getTime()) / 86_400_000;
  const rs   = days < 3 ? 25 : days < 7 ? 18 : days < 30 ? 10 : 3;

  const es =
    interactions === 0 ? 0 :
    interactions <= 2  ? 8 :
    interactions <= 5  ? 15 :
    interactions <= 10 ? 20 : 25;

  const total    = cs + is + ss + rs + es;
  const category = total >= 80 ? "HOT" : total >= 50 ? "WARM" : "COLD";

  await prisma.leadScore.upsert({
    where:  { leadId },
    create: { leadId, companySizeScore: cs, industryScore: is, sourceScore: ss, recencyScore: rs, engagementScore: es, totalScore: total, category, calculatedAt: new Date() },
    update: { companySizeScore: cs, industryScore: is, sourceScore: ss, recencyScore: rs, engagementScore: es, totalScore: total, category, calculatedAt: new Date() },
  });

  return { total, category };
}

// ---------------------------------------------------------------------------
// Lead definitions
// ---------------------------------------------------------------------------

type ActivityDef = {
  type: "LEAD_CREATED"|"STAGE_CHANGED"|"NOTE_ADDED"|"EMAIL_SENT"|"CALL_MADE"|"MEETING_SCHEDULED"|"MEETING_HELD"|"PROPOSAL_SENT";
  description: string;
  daysAgo: number;
};

type LeadDef = {
  firstName:    string;
  lastName:     string;
  email:        string;
  phone:        string;
  company:      string;
  jobTitle:     string;
  source:       "WEBSITE"|"REFERRAL"|"SOCIAL_MEDIA"|"EMAIL_CAMPAIGN"|"COLD_CALL"|"TRADE_SHOW"|"PARTNER"|"OTHER";
  stage:        "NEW"|"CONTACTED"|"QUALIFIED"|"PROPOSAL"|"WON"|"LOST";
  priority:     "LOW"|"MEDIUM"|"HIGH";
  companySize:  "SMALL"|"MEDIUM"|"LARGE"|"ENTERPRISE";
  industry:     "TECHNOLOGY"|"FINANCE"|"HEALTHCARE"|"RETAIL"|"MANUFACTURING"|"EDUCATION"|"REAL_ESTATE"|"GOVERNMENT"|"NON_PROFIT";
  dealValue:    number;
  tags:         string[];
  contactedAt?: Date;
  qualifiedAt?: Date;
  proposalAt?:  Date;
  convertedAt?: Date;
  lostAt?:      Date;
  lostReason?:  string;
  winReason?:   string;
  createdAt:    Date;
  activities:   ActivityDef[];
};

const LEADS: LeadDef[] = [
  // ── NEW (3) ─────────────────────────────────────────────────────────────────
  {
    firstName: "Arjun", lastName: "Kapoor",
    email: "arjun.kapoor@quantumtech.in", phone: "+91 9812345678",
    company: "Quantum Technologies", jobTitle: "Head of IT",
    source: "WEBSITE", stage: "NEW", priority: "HIGH",
    companySize: "LARGE", industry: "TECHNOLOGY",
    dealValue: 480000, tags: ["saas", "tech"],
    createdAt: daysAgo(2),
    activities: [
      { type: "LEAD_CREATED",  description: "Lead captured via website contact form",  daysAgo: 2 },
      { type: "EMAIL_SENT",    description: "Welcome email sent with product brochure", daysAgo: 1 },
    ],
  },
  {
    firstName: "Priya", lastName: "Nair",
    email: "priya.nair@sunriseretail.in", phone: "+91 9876543210",
    company: "Sunrise Retail Group", jobTitle: "VP Procurement",
    source: "REFERRAL", stage: "NEW", priority: "MEDIUM",
    companySize: "MEDIUM", industry: "RETAIL",
    dealValue: 220000, tags: ["retail", "referral"],
    createdAt: daysAgo(3),
    activities: [
      { type: "LEAD_CREATED", description: "Lead referred by existing client Ravi Shankar", daysAgo: 3 },
      { type: "EMAIL_SENT",   description: "Initial outreach email sent",                  daysAgo: 2 },
    ],
  },
  {
    firstName: "Suresh", lastName: "Yadav",
    email: "suresh.yadav@horizonmfg.com", phone: "+91 9765432109",
    company: "Horizon Manufacturing", jobTitle: "Operations Director",
    source: "TRADE_SHOW", stage: "NEW", priority: "LOW",
    companySize: "MEDIUM", industry: "MANUFACTURING",
    dealValue: 150000, tags: ["manufacturing", "ops"],
    createdAt: daysAgo(1),
    activities: [
      { type: "LEAD_CREATED", description: "Met at IndiaMart Expo 2026", daysAgo: 1 },
    ],
  },

  // ── CONTACTED (3) ───────────────────────────────────────────────────────────
  {
    firstName: "Meera", lastName: "Reddy",
    email: "meera.reddy@zenithhealth.in", phone: "+91 9654321098",
    company: "Zenith Healthcare", jobTitle: "CIO",
    source: "EMAIL_CAMPAIGN", stage: "CONTACTED", priority: "HIGH",
    companySize: "LARGE", industry: "HEALTHCARE",
    dealValue: 750000, tags: ["healthcare", "enterprise"],
    contactedAt: daysAgo(5),
    createdAt: daysAgo(12),
    activities: [
      { type: "LEAD_CREATED",        description: "Lead from email campaign — Healthcare IT series",    daysAgo: 12 },
      { type: "EMAIL_SENT",          description: "Initial outreach sent",                              daysAgo: 10 },
      { type: "CALL_MADE",           description: "Discovery call — 15 min, discussed pain points",     daysAgo:  5 },
      { type: "EMAIL_SENT",          description: "Follow-up email with case studies",                  daysAgo:  4 },
    ],
  },
  {
    firstName: "Vikram", lastName: "Malhotra",
    email: "vikram.malhotra@silverstone.fin", phone: "+91 9543210987",
    company: "Silverstone Finance", jobTitle: "CFO",
    source: "COLD_CALL", stage: "CONTACTED", priority: "MEDIUM",
    companySize: "SMALL", industry: "FINANCE",
    dealValue: 95000, tags: ["fintech", "smb"],
    contactedAt: daysAgo(3),
    createdAt: daysAgo(8),
    activities: [
      { type: "LEAD_CREATED", description: "Cold call lead — responded positively",      daysAgo: 8 },
      { type: "CALL_MADE",    description: "Intro call — 10 min, interested in demo",    daysAgo: 3 },
    ],
  },
  {
    firstName: "Deepa", lastName: "Iyer",
    email: "deepa.iyer@eliteacademy.edu", phone: "+91 9432109876",
    company: "Elite Academy Group", jobTitle: "Director - Technology",
    source: "SOCIAL_MEDIA", stage: "CONTACTED", priority: "MEDIUM",
    companySize: "MEDIUM", industry: "EDUCATION",
    dealValue: 185000, tags: ["edtech", "schools"],
    contactedAt: daysAgo(2),
    createdAt: daysAgo(9),
    activities: [
      { type: "LEAD_CREATED", description: "Inbound via LinkedIn DM",                     daysAgo: 9 },
      { type: "EMAIL_SENT",   description: "Sent company overview deck",                  daysAgo: 5 },
      { type: "CALL_MADE",    description: "Brief intro call — scheduling product demo",  daysAgo: 2 },
    ],
  },

  // ── QUALIFIED (3) ───────────────────────────────────────────────────────────
  {
    firstName: "Rahul", lastName: "Sharma",
    email: "rahul.sharma@nexusrealty.com", phone: "+91 9321098765",
    company: "Nexus Realty", jobTitle: "MD",
    source: "REFERRAL", stage: "QUALIFIED", priority: "HIGH",
    companySize: "LARGE", industry: "REAL_ESTATE",
    dealValue: 1200000, tags: ["real-estate", "enterprise"],
    contactedAt: daysAgo(18),
    qualifiedAt: daysAgo(8),
    createdAt: daysAgo(25),
    activities: [
      { type: "LEAD_CREATED",       description: "Referred by Amit Gupta, Nexus Group",          daysAgo: 25 },
      { type: "EMAIL_SENT",         description: "Introduction and product overview sent",        daysAgo: 22 },
      { type: "CALL_MADE",          description: "45-min discovery call — confirmed budget",      daysAgo: 18 },
      { type: "MEETING_SCHEDULED",  description: "Product demo scheduled for next week",          daysAgo: 15 },
      { type: "MEETING_HELD",       description: "Demo conducted — 2 hrs, very positive",         daysAgo: 10 },
      { type: "EMAIL_SENT",         description: "Sent demo recording + FAQ doc",                 daysAgo:  8 },
    ],
  },
  {
    firstName: "Ananya", lastName: "Singh",
    email: "ananya.singh@digitalpioneer.in", phone: "+91 9210987654",
    company: "Digital Pioneer Ltd.", jobTitle: "CTO",
    source: "WEBSITE", stage: "QUALIFIED", priority: "HIGH",
    companySize: "MEDIUM", industry: "TECHNOLOGY",
    dealValue: 550000, tags: ["saas", "startup"],
    contactedAt: daysAgo(14),
    qualifiedAt: daysAgo(6),
    createdAt: daysAgo(20),
    activities: [
      { type: "LEAD_CREATED",      description: "Website demo request submitted",              daysAgo: 20 },
      { type: "EMAIL_SENT",        description: "Welcome + demo booking link sent",            daysAgo: 19 },
      { type: "CALL_MADE",         description: "30-min discovery — strong technical fit",     daysAgo: 14 },
      { type: "MEETING_HELD",      description: "Technical deep-dive session — 90 mins",       daysAgo:  8 },
      { type: "EMAIL_SENT",        description: "Sent technical specs and integration guide",  daysAgo:  6 },
    ],
  },
  {
    firstName: "Karan", lastName: "Verma",
    email: "karan.verma@impactlogistics.in", phone: "+91 9109876543",
    company: "Impact Logistics Pvt. Ltd.", jobTitle: "Head of Supply Chain",
    source: "PARTNER", stage: "QUALIFIED", priority: "MEDIUM",
    companySize: "MEDIUM", industry: "MANUFACTURING",
    dealValue: 340000, tags: ["logistics", "supply-chain"],
    contactedAt: daysAgo(20),
    qualifiedAt: daysAgo(9),
    createdAt: daysAgo(28),
    activities: [
      { type: "LEAD_CREATED",      description: "Partner referral — Infosys partner network",  daysAgo: 28 },
      { type: "CALL_MADE",         description: "Intro call — 20 min, positive reception",     daysAgo: 20 },
      { type: "EMAIL_SENT",        description: "Sent partnership one-pager",                  daysAgo: 17 },
      { type: "MEETING_SCHEDULED", description: "Qualification call with VP booked",           daysAgo: 12 },
      { type: "CALL_MADE",         description: "Qualification call — confirmed requirements", daysAgo:  9 },
    ],
  },

  // ── PROPOSAL (3) ────────────────────────────────────────────────────────────
  {
    firstName: "Nikhil", lastName: "Patel",
    email: "nikhil.patel@globalautomation.in", phone: "+91 9098765432",
    company: "Global Automation Systems", jobTitle: "CEO",
    source: "REFERRAL", stage: "PROPOSAL", priority: "HIGH",
    companySize: "ENTERPRISE", industry: "MANUFACTURING",
    dealValue: 3500000, tags: ["enterprise", "automation"],
    contactedAt: daysAgo(45),
    qualifiedAt: daysAgo(30),
    proposalAt: daysAgo(10),
    createdAt: daysAgo(55),
    activities: [
      { type: "LEAD_CREATED",      description: "High-value referral — CEO connect",            daysAgo: 55 },
      { type: "EMAIL_SENT",        description: "Executive overview sent",                       daysAgo: 52 },
      { type: "CALL_MADE",         description: "CEO-level intro call — 30 min",                daysAgo: 45 },
      { type: "MEETING_SCHEDULED", description: "Exec presentation scheduled",                  daysAgo: 40 },
      { type: "MEETING_HELD",      description: "Boardroom presentation — 2 hrs, very strong",  daysAgo: 35 },
      { type: "CALL_MADE",         description: "Q&A call post-presentation",                   daysAgo: 30 },
      { type: "EMAIL_SENT",        description: "Sent detailed requirements document",           daysAgo: 20 },
      { type: "PROPOSAL_SENT",     description: "Commercial proposal (₹35L) submitted",         daysAgo: 10 },
    ],
  },
  {
    firstName: "Siddharth", lastName: "Joshi",
    email: "siddharth.joshi@cloudnativeindia.io", phone: "+91 8987654321",
    company: "Cloud Native India", jobTitle: "VP Engineering",
    source: "WEBSITE", stage: "PROPOSAL", priority: "HIGH",
    companySize: "LARGE", industry: "TECHNOLOGY",
    dealValue: 1800000, tags: ["cloud", "devops", "enterprise"],
    contactedAt: daysAgo(35),
    qualifiedAt: daysAgo(22),
    proposalAt: daysAgo(7),
    createdAt: daysAgo(42),
    activities: [
      { type: "LEAD_CREATED",      description: "Inbound enterprise inquiry",                   daysAgo: 42 },
      { type: "EMAIL_SENT",        description: "Enterprise brochure sent",                     daysAgo: 40 },
      { type: "CALL_MADE",         description: "30-min discovery — clear SaaS requirement",    daysAgo: 35 },
      { type: "MEETING_HELD",      description: "Technical demo — 2 hrs, strong fit confirmed", daysAgo: 28 },
      { type: "CALL_MADE",         description: "Pricing discussion call",                      daysAgo: 22 },
      { type: "EMAIL_SENT",        description: "Commercial terms overview sent",               daysAgo: 15 },
      { type: "MEETING_HELD",      description: "Final scope alignment — 90 min",               daysAgo:  9 },
      { type: "PROPOSAL_SENT",     description: "Formal commercial proposal (₹18L) sent",       daysAgo:  7 },
    ],
  },
  {
    firstName: "Tanvi", lastName: "Gupta",
    email: "tanvi.gupta@precisionpharm.in", phone: "+91 8876543210",
    company: "Precision Pharmaceuticals", jobTitle: "IT Manager",
    source: "TRADE_SHOW", stage: "PROPOSAL", priority: "MEDIUM",
    companySize: "LARGE", industry: "HEALTHCARE",
    dealValue: 620000, tags: ["pharma", "healthcare"],
    contactedAt: daysAgo(28),
    qualifiedAt: daysAgo(15),
    proposalAt: daysAgo(5),
    createdAt: daysAgo(35),
    activities: [
      { type: "LEAD_CREATED",      description: "Met at Healthcare IT Summit",             daysAgo: 35 },
      { type: "CALL_MADE",         description: "Post-event follow-up call",               daysAgo: 28 },
      { type: "EMAIL_SENT",        description: "Regulatory compliance case study shared", daysAgo: 25 },
      { type: "MEETING_SCHEDULED", description: "Solution demo booked",                   daysAgo: 20 },
      { type: "MEETING_HELD",      description: "Product demo — 75 min, positive",        daysAgo: 16 },
      { type: "CALL_MADE",         description: "Negotiation call — pricing discussed",   daysAgo:  8 },
      { type: "PROPOSAL_SENT",     description: "Proposal (₹6.2L) submitted via email",   daysAgo:  5 },
    ],
  },

  // ── WON (3) ─────────────────────────────────────────────────────────────────
  {
    firstName: "Amit", lastName: "Gupta",
    email: "amit.gupta@techmatrix.in", phone: "+91 9800111222",
    company: "TechMatrix Solutions", jobTitle: "CEO",
    source: "REFERRAL", stage: "WON", priority: "HIGH",
    companySize: "ENTERPRISE", industry: "TECHNOLOGY",
    dealValue: 4200000, tags: ["enterprise", "strategic"],
    contactedAt: daysAgo(90), qualifiedAt: daysAgo(70),
    proposalAt: daysAgo(45),  convertedAt: daysAgo(20),
    createdAt: daysAgo(105),
    winReason: "Best-in-class product, strong references, competitive pricing with dedicated support.",
    activities: [
      { type: "LEAD_CREATED",      description: "Strategic referral from Nikhil Patel",           daysAgo: 105 },
      { type: "EMAIL_SENT",        description: "Executive introductory email",                    daysAgo: 100 },
      { type: "CALL_MADE",         description: "CEO-level discovery — 45 min",                   daysAgo:  90 },
      { type: "MEETING_HELD",      description: "Executive presentation — 2 hrs",                 daysAgo:  80 },
      { type: "CALL_MADE",         description: "Technical architecture review",                  daysAgo:  70 },
      { type: "MEETING_SCHEDULED", description: "Pilot PoC scoping session",                      daysAgo:  60 },
      { type: "MEETING_HELD",      description: "PoC review — all criteria met",                  daysAgo:  50 },
      { type: "PROPOSAL_SENT",     description: "Enterprise proposal (₹42L) sent",                daysAgo:  45 },
      { type: "CALL_MADE",         description: "Commercial negotiation — final round",            daysAgo:  25 },
      { type: "STAGE_CHANGED",     description: "Lead WON — contract signed ₹42L",               daysAgo:  20 },
    ],
  },
  {
    firstName: "Rekha", lastName: "Pillai",
    email: "rekha.pillai@meridiangroup.co.in", phone: "+91 9700222333",
    company: "Meridian Group", jobTitle: "COO",
    source: "PARTNER", stage: "WON", priority: "HIGH",
    companySize: "LARGE", industry: "REAL_ESTATE",
    dealValue: 1850000, tags: ["real-estate", "enterprise"],
    contactedAt: daysAgo(75), qualifiedAt: daysAgo(55),
    proposalAt: daysAgo(35),  convertedAt: daysAgo(10),
    createdAt: daysAgo(85),
    winReason: "Comprehensive feature set for property management, strong post-sale support commitment.",
    activities: [
      { type: "LEAD_CREATED",  description: "Partner-sourced lead — JLL partnership",    daysAgo: 85 },
      { type: "EMAIL_SENT",    description: "Real-estate vertical deck sent",             daysAgo: 80 },
      { type: "CALL_MADE",     description: "Stakeholder intro call — 30 min",           daysAgo: 75 },
      { type: "MEETING_HELD",  description: "Full demo with ops team — 2 hrs",           daysAgo: 60 },
      { type: "CALL_MADE",     description: "Negotiation — 3 rounds",                   daysAgo: 45 },
      { type: "PROPOSAL_SENT", description: "Proposal (₹18.5L) submitted",               daysAgo: 35 },
      { type: "MEETING_HELD",  description: "Contract review with legal & finance",      daysAgo: 15 },
      { type: "STAGE_CHANGED", description: "Lead WON — contract signed ₹18.5L",        daysAgo: 10 },
    ],
  },
  {
    firstName: "Gaurav", lastName: "Bose",
    email: "gaurav.bose@infinityfintech.in", phone: "+91 9600333444",
    company: "Infinity Fintech Solutions", jobTitle: "MD",
    source: "WEBSITE", stage: "WON", priority: "HIGH",
    companySize: "MEDIUM", industry: "FINANCE",
    dealValue: 980000, tags: ["fintech", "compliance"],
    contactedAt: daysAgo(60), qualifiedAt: daysAgo(42),
    proposalAt: daysAgo(25),  convertedAt: daysAgo(8),
    createdAt: daysAgo(70),
    winReason: "RBI-compliance features, cloud-first architecture, transparent pricing model.",
    activities: [
      { type: "LEAD_CREATED",  description: "Inbound demo request — fintech track",     daysAgo: 70 },
      { type: "EMAIL_SENT",    description: "Fintech compliance overview sent",          daysAgo: 68 },
      { type: "CALL_MADE",     description: "Discovery — RBI compliance requirements",  daysAgo: 60 },
      { type: "MEETING_HELD",  description: "Compliance-focused demo — 90 min",         daysAgo: 50 },
      { type: "EMAIL_SENT",    description: "Security whitepaper + audit trail docs",   daysAgo: 42 },
      { type: "PROPOSAL_SENT", description: "Proposal (₹9.8L) with SLA terms",          daysAgo: 25 },
      { type: "CALL_MADE",     description: "Final commercial agreement call",          daysAgo: 10 },
      { type: "STAGE_CHANGED", description: "Lead WON — agreement signed ₹9.8L",       daysAgo:  8 },
    ],
  },

  // ── LOST (3) ────────────────────────────────────────────────────────────────
  {
    firstName: "Rohit", lastName: "Agarwal",
    email: "rohit.agarwal@competitorxyz.com", phone: "+91 9500444555",
    company: "CompetitorXYZ Corp", jobTitle: "Purchase Manager",
    source: "COLD_CALL", stage: "LOST", priority: "LOW",
    companySize: "SMALL", industry: "RETAIL",
    dealValue: 85000, tags: ["smb"],
    contactedAt: daysAgo(40), qualifiedAt: daysAgo(28),
    lostAt: daysAgo(15),
    lostReason: "Chose competitor at 20% lower price. Budget constraint — may revisit FY27.",
    createdAt: daysAgo(50),
    activities: [
      { type: "LEAD_CREATED", description: "Cold call — expressed interest",              daysAgo: 50 },
      { type: "CALL_MADE",    description: "Discovery call — price-sensitive prospect",   daysAgo: 40 },
      { type: "EMAIL_SENT",   description: "Proposal sent — standard commercial terms",   daysAgo: 28 },
      { type: "CALL_MADE",    description: "Negotiation call — could not match price",    daysAgo: 18 },
      { type: "STAGE_CHANGED",description: "Lead LOST — price-based objection",           daysAgo: 15 },
    ],
  },
  {
    firstName: "Kavya", lastName: "Rao",
    email: "kavya.rao@dormantcorp.in", phone: "+91 9400555666",
    company: "Dormant Corp India", jobTitle: "IT Head",
    source: "EMAIL_CAMPAIGN", stage: "LOST", priority: "MEDIUM",
    companySize: "MEDIUM", industry: "MANUFACTURING",
    dealValue: 420000, tags: ["manufacturing"],
    contactedAt: daysAgo(55), qualifiedAt: daysAgo(40),
    proposalAt: daysAgo(25), lostAt: daysAgo(10),
    lostReason: "Budget freeze due to internal restructuring. Revisit Q3 FY27.",
    createdAt: daysAgo(65),
    activities: [
      { type: "LEAD_CREATED",  description: "Email campaign lead — manufacturing segment", daysAgo: 65 },
      { type: "EMAIL_SENT",    description: "Personalised follow-up with ROI calc",         daysAgo: 55 },
      { type: "CALL_MADE",     description: "Qualification call — strong interest",         daysAgo: 48 },
      { type: "MEETING_HELD",  description: "Product walkthrough — 60 min",                daysAgo: 40 },
      { type: "PROPOSAL_SENT", description: "Detailed proposal (₹4.2L) submitted",          daysAgo: 25 },
      { type: "CALL_MADE",     description: "Informed of budget freeze, noted for follow-up",daysAgo: 12 },
      { type: "STAGE_CHANGED", description: "Lead LOST — budget freeze",                    daysAgo: 10 },
    ],
  },
  {
    firstName: "Manish", lastName: "Chopra",
    email: "manish.chopra@stalled-deal.biz", phone: "+91 9300666777",
    company: "Northgate Ventures", jobTitle: "Founder",
    source: "SOCIAL_MEDIA", stage: "LOST", priority: "LOW",
    companySize: "SMALL", industry: "FINANCE",
    dealValue: 65000, tags: ["startup"],
    contactedAt: daysAgo(70), lostAt: daysAgo(30),
    lostReason: "Startup ran out of funding. Not viable at this time.",
    createdAt: daysAgo(80),
    activities: [
      { type: "LEAD_CREATED", description: "LinkedIn inbound — startup founder",         daysAgo: 80 },
      { type: "CALL_MADE",    description: "Intro call — interested but no clear budget", daysAgo: 70 },
      { type: "EMAIL_SENT",   description: "Startup pricing deck sent",                   daysAgo: 55 },
      { type: "CALL_MADE",    description: "Follow-up — informed of funding issues",      daysAgo: 35 },
      { type: "STAGE_CHANGED",description: "Lead LOST — funding constraints",             daysAgo: 30 },
    ],
  },
];

// ---------------------------------------------------------------------------
// CustomerInteraction definitions (for WON clients — drives health score)
// ---------------------------------------------------------------------------

type InteractionDef = {
  type:     "CALL"|"VISIT"|"NOTE"|"EMAIL"|"WHATSAPP";
  notes:    string;
  outcome:  string;
  daysAgo:  number;
  approved: boolean;
};

const WON_INTERACTIONS: Record<string, InteractionDef[]> = {
  "amit.gupta@techmatrix.in": [
    { type: "CALL",  notes: "Quarterly business review call — 45 min. Discussed expansion requirements.", outcome: "Positive — expanding to 3 more offices.",    daysAgo: 15, approved: true },
    { type: "VISIT", notes: "On-site check-in at TechMatrix HQ Bangalore.",                                outcome: "Resolved 2 open support tickets on-site.",    daysAgo:  5, approved: true },
    { type: "EMAIL", notes: "Sent upgrade proposal for Enterprise tier.",                                   outcome: "Client reviewing internally.",               daysAgo:  2, approved: true },
  ],
  "rekha.pillai@meridiangroup.co.in": [
    { type: "CALL",  notes: "Post-go-live check-in call — 30 min. Very positive feedback.",                outcome: "No issues, very satisfied.",                  daysAgo: 7, approved: true },
    { type: "EMAIL", notes: "Shared new feature release notes for Q1 2026.",                               outcome: "Acknowledged, exploring new features.",       daysAgo: 3, approved: true },
  ],
  "gaurav.bose@infinityfintech.in": [
    { type: "CALL",  notes: "Compliance review call — discussed RBI audit requirements.",                   outcome: "All compliance checks passed.",               daysAgo: 6, approved: true },
    { type: "VISIT", notes: "On-site compliance documentation review.",                                     outcome: "Documentation complete, audit-ready.",        daysAgo: 2, approved: true },
  ],
};

// ---------------------------------------------------------------------------
// Reminder definitions for active leads
// ---------------------------------------------------------------------------

type ReminderDef = {
  titleTemplate: string;
  description:   string;
  daysOffset:    number;  // positive = future, negative = overdue
  status:        "PENDING"|"OVERDUE";
};

const STAGE_REMINDERS: Record<string, ReminderDef> = {
  NEW:       { titleTemplate: "Send introduction email",   description: "New lead — reach out within 24 hrs.",      daysOffset:  1, status: "PENDING" },
  CONTACTED: { titleTemplate: "Follow-up call scheduled",  description: "Schedule qualification call this week.",    daysOffset:  3, status: "PENDING" },
  QUALIFIED: { titleTemplate: "Schedule product demo",     description: "Book 60-min product demonstration.",        daysOffset:  2, status: "PENDING" },
  PROPOSAL:  { titleTemplate: "Follow up on proposal",     description: "Chase proposal response — deadline set.",   daysOffset: -2, status: "OVERDUE" },
};

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

async function main() {
  console.log("\n🚀 seed-crm: starting...\n");

  // Check which emails already exist
  const existingEmails = new Set(
    (await prisma.lead.findMany({ select: { email: true } })).map((l) => l.email)
  );

  let leadsCreated       = 0;
  let activitiesCreated  = 0;
  let scoresComputed     = 0;
  let clientsCreated     = 0;
  let interactionsCreated= 0;
  let remindersCreated   = 0;

  // ── 1. Create leads ────────────────────────────────────────────────────────
  const createdLeads: Array<{ id: string; email: string; stage: string }> = [];

  for (const def of LEADS) {
    if (existingEmails.has(def.email)) {
      console.log(`   ⏭  Lead ${def.email} already exists — skipping`);
      const existing = await prisma.lead.findFirst({ where: { email: def.email }, select: { id: true, email: true, stage: true } });
      if (existing) createdLeads.push(existing);
      continue;
    }

    // Create Client first for WON leads
    let clientId: string | undefined;
    if (def.stage === "WON") {
      const existing = await prisma.client.findFirst({ where: { email: def.email } });
      if (existing) {
        clientId = existing.id;
      } else {
        const client = await prisma.client.create({
          data: {
            firstName: def.firstName,
            lastName:  def.lastName,
            email:     def.email,
            phone:     def.phone,
            company:   def.company,
            jobTitle:  def.jobTitle,
            assignedTo: "admin",
            tags:      def.tags,
          },
        });
        clientId = client.id;
        clientsCreated++;
      }
    }

    const lead = await prisma.lead.create({
      data: {
        firstName:   def.firstName,
        lastName:    def.lastName,
        email:       def.email,
        phone:       def.phone,
        company:     def.company,
        jobTitle:    def.jobTitle,
        source:      def.source,
        stage:       def.stage,
        priority:    def.priority,
        companySize: def.companySize,
        industry:    def.industry,
        dealValue:   def.dealValue,
        tags:        def.tags,
        assignedTo:  "admin",
        contactedAt: def.contactedAt,
        qualifiedAt: def.qualifiedAt,
        proposalAt:  def.proposalAt,
        convertedAt: def.convertedAt,
        lostAt:      def.lostAt,
        lostReason:  def.lostReason,
        winReason:   def.winReason,
        clientId,
        createdAt:   def.createdAt,
        // Set lastActivityAt to the most recent activity date
        lastActivityAt: new Date(Date.now() - Math.min(...def.activities.map(a => a.daysAgo)) * 86_400_000),
      },
    });

    // Create activities
    for (const act of def.activities) {
      await prisma.leadActivity.create({
        data: {
          leadId:      lead.id,
          type:        act.type,
          description: act.description,
          performedBy: "admin",
          createdAt:   daysAgo(act.daysAgo),
        },
      });
      activitiesCreated++;
    }

    createdLeads.push({ id: lead.id, email: def.email, stage: def.stage });
    leadsCreated++;

    const stageIcon = def.stage === "WON" ? "🏆" : def.stage === "LOST" ? "❌" : def.stage === "PROPOSAL" ? "📄" : def.stage === "QUALIFIED" ? "✅" : def.stage === "CONTACTED" ? "📞" : "🆕";
    console.log(`   ${stageIcon} [${def.stage}] ${def.firstName} ${def.lastName} (${def.company}) — ${def.activities.length} activities`);
  }

  // ── 2. Compute scores for all created/existing leads ──────────────────────
  console.log("\n🔢 Computing lead scores...");
  for (const lead of createdLeads) {
    try {
      const { total, category } = await computeAndSaveScore(lead.id);
      const icon = category === "HOT" ? "🔴" : category === "WARM" ? "🟡" : "⚪";
      console.log(`   ${icon} ${lead.email}: ${total} (${category})`);
      scoresComputed++;
    } catch (err) {
      console.error(`   ⚠ Score failed for ${lead.email}:`, err);
    }
  }

  // ── 3. Create CustomerInteractions for WON client leads ───────────────────
  console.log("\n💬 Creating customer interactions...");
  for (const lead of createdLeads.filter((l) => l.stage === "WON")) {
    const interDefs = WON_INTERACTIONS[lead.email];
    if (!interDefs) continue;

    const client = await prisma.client.findFirst({ where: { email: lead.email } });
    if (!client) continue;

    const staff = await prisma.staff.findFirst({ where: { email: "admin@askworx.com" } });

    for (const iDef of interDefs) {
      const existing = await prisma.customerInteraction.findFirst({
        where: { clientId: client.id, type: iDef.type, notes: iDef.notes },
      });
      if (existing) continue;

      await prisma.customerInteraction.create({
        data: {
          clientId:  client.id,
          staffId:   staff?.id,
          type:      iDef.type,
          date:      daysAgo(iDef.daysAgo),
          notes:     iDef.notes,
          outcome:   iDef.outcome,
          approved:  iDef.approved,
          rejected:  false,
          direction: "OUTBOUND",
        },
      });
      interactionsCreated++;
    }
  }
  console.log(`   ✅ ${interactionsCreated} interactions created`);

  // ── 4. Create FollowUpReminders for active leads ──────────────────────────
  console.log("\n🔔 Creating follow-up reminders...");
  const ACTIVE_STAGES = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL"];

  for (const lead of createdLeads.filter((l) => ACTIVE_STAGES.includes(l.stage))) {
    const reminderDef = STAGE_REMINDERS[lead.stage];
    if (!reminderDef) continue;

    // Check if reminder already exists
    const existing = await prisma.followUpReminder.findFirst({
      where: { leadId: lead.id, title: { startsWith: reminderDef.titleTemplate } },
    });
    if (existing) continue;

    // Find lead name
    const leadRecord = await prisma.lead.findUnique({
      where: { id: lead.id },
      select: { firstName: true, lastName: true },
    });

    await prisma.followUpReminder.create({
      data: {
        leadId:      lead.id,
        type:        "FOLLOW_UP",
        title:       `${reminderDef.titleTemplate} — ${leadRecord?.firstName} ${leadRecord?.lastName}`,
        description: reminderDef.description,
        dueAt:       daysAhead(reminderDef.daysOffset),
        status:      reminderDef.status,
        assignedTo:  "admin",
        createdBy:   "seed",
      },
    });
    remindersCreated++;
  }
  console.log(`   ✅ ${remindersCreated} reminders created`);

  // ── 5. Backfill scores for any pre-existing leads without a score ─────────
  console.log("\n🔄 Backfilling scores for unscored leads...");
  const unscoredLeads = await prisma.lead.findMany({
    where:  { score: null },
    select: { id: true, email: true },
  });
  for (const l of unscoredLeads) {
    try {
      await computeAndSaveScore(l.id);
      scoresComputed++;
    } catch { /* skip */ }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const [totalLeads, totalScores, hotCount, warmCount, coldCount, totalReminders, totalInteractions] =
    await Promise.all([
      prisma.lead.count(),
      prisma.leadScore.count(),
      prisma.leadScore.count({ where: { category: "HOT"  } }),
      prisma.leadScore.count({ where: { category: "WARM" } }),
      prisma.leadScore.count({ where: { category: "COLD" } }),
      prisma.followUpReminder.count({ where: { status: { in: ["PENDING", "OVERDUE"] } } }),
      prisma.customerInteraction.count(),
    ]);

  console.log("\n─────────────────────────────────────────");
  console.log(`✅ Leads created      : ${leadsCreated}`);
  console.log(`✅ Activities created : ${activitiesCreated}`);
  console.log(`✅ Clients created    : ${clientsCreated}`);
  console.log(`✅ Interactions       : ${interactionsCreated}`);
  console.log(`✅ Reminders          : ${remindersCreated}`);
  console.log(`✅ Scores computed    : ${scoresComputed}`);
  console.log(`\n📊 Database totals:`);
  console.log(`   Leads         : ${totalLeads}`);
  console.log(`   Scored leads  : ${totalScores}`);
  console.log(`   🔴 HOT        : ${hotCount}`);
  console.log(`   🟡 WARM       : ${warmCount}`);
  console.log(`   ⚪ COLD       : ${coldCount}`);
  console.log(`   Active remind : ${totalReminders}`);
  console.log(`   Interactions  : ${totalInteractions}`);
  console.log("\n🎉 seed-crm done!\n");
}

main()
  .catch((e) => {
    console.error("❌ seed-crm failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
