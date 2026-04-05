#!/usr/bin/env node
/**
 * ============================================================================
 * seedModule7.js — HR Vault + Video + Quiz Test Data Seeder
 * ASKworX CRM Platform
 * ============================================================================
 *
 * Usage (from project root):
 *   node scripts/seedModule7.js           # seed all data
 *   node scripts/seedModule7.js --clean   # remove seed data only
 *   node scripts/seedModule7.js --reset   # clean + re-seed
 *   node scripts/seedModule7.js --verify  # print counts without modifying
 *
 * All seed records are tagged with uploadedBy = 'seed-script' (documents/videos)
 * or email ending in '@vault-seed.test' (staff), making cleanup safe and precise.
 * ============================================================================
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const { Pool } = require("pg");
const { v4: uuidv4 } = require("uuid");

// ─── DB Connection ────────────────────────────────────────────────────────────

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("sslmode=require")
    ? { rejectUnauthorized: false }
    : false,
});

// ─── Seed Marker ──────────────────────────────────────────────────────────────

const SEED_MARKER   = "seed-script";
const SEED_EMAIL_SUFFIX = "@vault-seed.test";

// ─── Fixed IDs (deterministic — same IDs every run) ──────────────────────────

const STAFF = {
  admin:   { id: "seed-admin-001",   firstName: "Arjun",   lastName: "Mehta",   email: "arjun.mehta"   + SEED_EMAIL_SUFFIX, role: "ADMIN",   dept: "HR & Operations" },
  mgr1:    { id: "seed-mgr-001",     firstName: "Priya",   lastName: "Sharma",  email: "priya.sharma"  + SEED_EMAIL_SUFFIX, role: "MANAGER", dept: "Engineering" },
  mgr2:    { id: "seed-mgr-002",     firstName: "Rohan",   lastName: "Kapoor",  email: "rohan.kapoor"  + SEED_EMAIL_SUFFIX, role: "MANAGER", dept: "Finance" },
  emp1:    { id: "seed-emp-001",     firstName: "Divya",   lastName: "Nair",    email: "divya.nair"    + SEED_EMAIL_SUFFIX, role: "STAFF",   dept: "Engineering" },
  emp2:    { id: "seed-emp-002",     firstName: "Aakash",  lastName: "Verma",   email: "aakash.verma"  + SEED_EMAIL_SUFFIX, role: "STAFF",   dept: "Sales" },
  emp3:    { id: "seed-emp-003",     firstName: "Sneha",   lastName: "Patel",   email: "sneha.patel"   + SEED_EMAIL_SUFFIX, role: "STAFF",   dept: "Marketing" },
  emp4:    { id: "seed-emp-004",     firstName: "Vikram",  lastName: "Singh",   email: "vikram.singh"  + SEED_EMAIL_SUFFIX, role: "STAFF",   dept: "Finance" },
  emp5:    { id: "seed-emp-005",     firstName: "Kavya",   lastName: "Reddy",   email: "kavya.reddy"   + SEED_EMAIL_SUFFIX, role: "STAFF",   dept: "Engineering" },
};

// Dates helpers
const now    = new Date();
const daysAgo  = (n) => new Date(now - n * 86400000).toISOString();
const daysFrom = (n) => new Date(now.getTime() + n * 86400000).toISOString();

// Fixed document UUIDs
const DOC_IDS = Array.from({ length: 16 }, (_, i) =>
  `d${String(i + 1).padStart(7, "0")}-seed-4000-a000-000000000000`
);

// Fixed video UUIDs
const VID_IDS = Array.from({ length: 9 }, (_, i) =>
  `v${String(i + 1).padStart(7, "0")}-seed-4000-b000-000000000000`
);

// Fixed quiz UUIDs
const QUIZ_IDS = {
  fireSafety:       `q0000001-seed-4000-c000-000000000000`,
  workplaceEthics:  `q0000002-seed-4000-c000-000000000000`,
  dataProtection:   `q0000003-seed-4000-c000-000000000000`,
};

// Question UUIDs
const QQ = (quizIdx, qIdx) =>
  `qq${String(quizIdx).padStart(6, "0")}-${String(qIdx).padStart(4, "0")}-4000-c000-000000000000`;

// ─── 1. DOCUMENTS ─────────────────────────────────────────────────────────────

const DOCUMENTS = [
  // ── Critical expiry (≤7 days) ──
  {
    id: DOC_IDS[0],
    title: "Code of Conduct Policy 2025",
    description: "Employee code of conduct and workplace behavioural guidelines.",
    category: "COMPLIANCE",
    accessLevel: "ALL",
    requiresAck: true,
    expiresAt: daysFrom(3),   // 3 days → HIGH warning
    tags: ["compliance", "conduct", "hr"],
  },
  {
    id: DOC_IDS[1],
    title: "Data Protection & Privacy Notice",
    description: "GDPR and data protection obligations for all staff.",
    category: "COMPLIANCE",
    accessLevel: "ALL",
    requiresAck: true,
    expiresAt: daysFrom(6),   // 6 days → HIGH warning
    tags: ["gdpr", "data-protection", "legal"],
  },
  {
    id: DOC_IDS[2],
    title: "Onboarding Checklist — New Joiners",
    description: "Mandatory checklist for all new joiners to complete in week 1.",
    category: "FORM",
    accessLevel: "ALL",
    requiresAck: true,
    expiresAt: daysFrom(5),   // 5 days → HIGH warning
    tags: ["onboarding", "form", "hr"],
  },

  // ── Medium expiry (8–30 days) ──
  {
    id: DOC_IDS[3],
    title: "IT Security Policy v3.1",
    description: "Acceptable use policy for IT systems, password management, and incident reporting.",
    category: "POLICY",
    accessLevel: "ALL",
    requiresAck: true,
    expiresAt: daysFrom(14),  // 14 days → MEDIUM warning
    tags: ["it", "security", "policy"],
  },
  {
    id: DOC_IDS[4],
    title: "Annual Leave Policy",
    description: "Rules and procedures governing annual leave entitlements.",
    category: "POLICY",
    accessLevel: "ALL",
    requiresAck: false,
    expiresAt: daysFrom(25),  // 25 days → MEDIUM warning
    tags: ["leave", "hr", "policy"],
  },

  // ── Low expiry (31–90 days) ──
  {
    id: DOC_IDS[5],
    title: "Travel & Expense Reimbursement SOP",
    description: "Standard operating procedure for claiming business travel and expenses.",
    category: "SOP",
    accessLevel: "ALL",
    requiresAck: false,
    expiresAt: daysFrom(45),  // 45 days → LOW warning
    tags: ["travel", "expenses", "finance"],
  },
  {
    id: DOC_IDS[6],
    title: "Performance Review Template Q4",
    description: "Manager-facing template for annual performance reviews.",
    category: "FORM",
    accessLevel: "MANAGER_ONLY",
    requiresAck: false,
    expiresAt: daysFrom(60),  // 60 days → LOW warning
    tags: ["performance", "review", "manager"],
  },

  // ── Safe (>90 days or no expiry) ──
  {
    id: DOC_IDS[7],
    title: "Employee Handbook v4.0",
    description: "Comprehensive guide covering all company policies, benefits and procedures.",
    category: "HANDBOOK",
    accessLevel: "ALL",
    requiresAck: true,
    expiresAt: daysFrom(180), // 180 days → SAFE (green)
    tags: ["handbook", "policies", "benefits"],
  },
  {
    id: DOC_IDS[8],
    title: "Workplace Safety & Health Manual",
    description: "OSH compliance manual including emergency procedures.",
    category: "SOP",
    accessLevel: "ALL",
    requiresAck: true,
    expiresAt: null,          // No expiry
    tags: ["safety", "health", "compliance"],
  },
  {
    id: DOC_IDS[9],
    title: "Diversity, Equity & Inclusion Charter",
    description: "Company DEI commitments, reporting lines, and grievance procedures.",
    category: "POLICY",
    accessLevel: "ALL",
    requiresAck: false,
    expiresAt: null,
    tags: ["dei", "hr", "culture"],
  },

  // ── Restricted access ──
  {
    id: DOC_IDS[10],
    title: "Senior Management Compensation Framework",
    description: "Compensation bands and bonus structures for senior leadership.",
    category: "CONTRACT",
    accessLevel: "HR_ONLY",
    requiresAck: false,
    expiresAt: daysFrom(365),
    tags: ["compensation", "confidential", "hr-only"],
  },
  {
    id: DOC_IDS[11],
    title: "Q3 Budget Variance Report — Finance",
    description: "Internal finance report on Q3 budget vs actuals.",
    category: "COMPLIANCE",
    accessLevel: "MANAGER_ONLY",
    requiresAck: false,
    expiresAt: daysFrom(90),
    tags: ["finance", "budget", "report"],
  },

  // ── EXPIRED docs ──
  {
    id: DOC_IDS[12],
    title: "Workplace Harassment Policy 2023",
    description: "SUPERSEDED. Please refer to the 2025 updated version.",
    category: "POLICY",
    accessLevel: "ALL",
    requiresAck: true,
    expiresAt: daysAgo(30),  // 30 days ago → EXPIRED
    tags: ["harassment", "policy", "outdated"],
    status: "EXPIRED",
  },
  {
    id: DOC_IDS[13],
    title: "Remote Work Agreement — COVID Extension",
    description: "Temporary remote work policy extension. No longer in effect.",
    category: "CONTRACT",
    accessLevel: "ALL",
    requiresAck: false,
    expiresAt: daysAgo(90),  // 90 days ago → EXPIRED
    tags: ["remote", "expired", "wfh"],
    status: "EXPIRED",
  },

  // ── Contract (variety) ──
  {
    id: DOC_IDS[14],
    title: "Software Vendor NDA — Salesforce",
    description: "Non-disclosure agreement with Salesforce Inc. for CRM implementation.",
    category: "CONTRACT",
    accessLevel: "MANAGER_ONLY",
    requiresAck: false,
    expiresAt: daysFrom(120),
    tags: ["nda", "vendor", "salesforce"],
  },
  {
    id: DOC_IDS[15],
    title: "Background Verification Consent Form",
    description: "Staff consent for pre-employment background verification.",
    category: "FORM",
    accessLevel: "HR_ONLY",
    requiresAck: true,
    expiresAt: null,
    tags: ["bgv", "consent", "onboarding"],
  },
];

// ─── 2. VIDEOS ────────────────────────────────────────────────────────────────

// Sample public MP4 URLs (replace with real Cloudinary URLs in production)
const SAMPLE_VIDEOS = [
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4",
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
];

const VIDEOS = [
  {
    id: VID_IDS[0],
    title: "Company Onboarding — Welcome to ASKworX",
    description: "A complete walkthrough of company culture, values, teams, and your first 30 days.",
    category: "ONBOARDING",
    status: "READY",
    duration: 2700,   // 45 min
    isRequired: true,
    accessLevel: "ALL",
    tags: ["onboarding", "culture", "welcome"],
  },
  {
    id: VID_IDS[1],
    title: "Fire Safety & Emergency Evacuation",
    description: "Mandatory annual fire safety training covering evacuation routes, assembly points, and fire extinguisher use.",
    category: "SAFETY",
    status: "READY",
    duration: 900,    // 15 min
    isRequired: true,
    accessLevel: "ALL",
    tags: ["fire", "safety", "mandatory", "annual"],
  },
  {
    id: VID_IDS[2],
    title: "Workplace Ethics & Code of Conduct",
    description: "Understanding ethical behaviour at work, conflict of interest, and whistleblower protections.",
    category: "COMPLIANCE",
    status: "READY",
    duration: 1800,   // 30 min
    isRequired: true,
    accessLevel: "ALL",
    tags: ["ethics", "compliance", "mandatory"],
  },
  {
    id: VID_IDS[3],
    title: "Data Protection & GDPR Essentials",
    description: "Practical guide to GDPR obligations, data handling, and what to do if a breach occurs.",
    category: "COMPLIANCE",
    status: "READY",
    duration: 1500,   // 25 min
    isRequired: false,
    accessLevel: "ALL",
    tags: ["gdpr", "data", "privacy"],
  },
  {
    id: VID_IDS[4],
    title: "Microsoft Teams Advanced Features",
    description: "Tips and tricks for channels, meetings, integrations, and productivity shortcuts.",
    category: "TRAINING",
    status: "READY",
    duration: 1200,   // 20 min
    isRequired: false,
    accessLevel: "ALL",
    tags: ["teams", "microsoft", "tools"],
  },
  {
    id: VID_IDS[5],
    title: "Diversity, Equity & Inclusion at Work",
    description: "Building an inclusive workplace — bias awareness, allyship, and reporting discrimination.",
    category: "GENERAL",
    status: "READY",
    duration: 2100,   // 35 min
    isRequired: false,
    accessLevel: "ALL",
    tags: ["dei", "inclusion", "culture"],
  },
  {
    id: VID_IDS[6],
    title: "ASKworX Product Deep-Dive for Sales",
    description: "Sales team training on all platform modules, pricing, and competitive positioning.",
    category: "TRAINING",
    status: "READY",
    duration: 3000,   // 50 min
    isRequired: false,
    accessLevel: "ALL",
    tags: ["product", "sales", "crm"],
  },
  {
    id: VID_IDS[7],
    title: "Annual Compliance Refresher 2025",
    description: "Yearly compliance update covering regulatory changes relevant to all departments.",
    category: "COMPLIANCE",
    status: "PROCESSING",  // still being processed
    duration: null,
    isRequired: true,
    accessLevel: "ALL",
    tags: ["compliance", "annual", "2025"],
  },
  {
    id: VID_IDS[8],
    title: "Emergency First Aid Basics",
    description: "CPR, choking, bleeding and shock management for non-medical staff.",
    category: "SAFETY",
    status: "READY",
    duration: 600,    // 10 min
    isRequired: false,
    accessLevel: "ALL",
    tags: ["first-aid", "safety", "cpr"],
  },
];

// ─── 3. QUIZZES ───────────────────────────────────────────────────────────────

const QUIZZES = [
  {
    id: QUIZ_IDS.fireSafety,
    videoId: VID_IDS[1],   // Fire Safety video
    passMark: 70,
    questions: [
      {
        id: QQ(1, 1),
        question: "What is the FIRST thing you should do when you discover a fire?",
        options: [
          "Try to extinguish it immediately",
          "Raise the alarm and alert others",
          "Call the fire department first",
          "Evacuate without telling anyone",
        ],
        correctIdx: 1,
        explanation: "Always raise the alarm first to ensure everyone is alerted before attempting any firefighting.",
        order: 0,
      },
      {
        id: QQ(1, 2),
        question: "Where is the primary fire assembly point for ASKworX?",
        options: [
          "Main entrance lobby",
          "Parking lot B — North side",
          "Rooftop terrace",
          "Basement cafeteria",
        ],
        correctIdx: 1,
        explanation: "The primary assembly point is Parking Lot B on the north side of the building.",
        order: 1,
      },
      {
        id: QQ(1, 3),
        question: "Which fire extinguisher type is safe to use on electrical equipment?",
        options: [
          "Water (red label)",
          "Foam (cream label)",
          "CO2 (black label)",
          "Powder (blue label)",
        ],
        correctIdx: 2,
        explanation: "CO2 extinguishers are safe on electrical fires as they don't conduct electricity.",
        order: 2,
      },
    ],
  },
  {
    id: QUIZ_IDS.workplaceEthics,
    videoId: VID_IDS[2],   // Workplace Ethics video
    passMark: 70,
    questions: [
      {
        id: QQ(2, 1),
        question: "What constitutes a conflict of interest?",
        options: [
          "Disagreeing with your manager's decision",
          "Having a personal relationship that influences your professional judgement",
          "Working overtime on weekends",
          "Receiving a promotion before a colleague",
        ],
        correctIdx: 1,
        explanation: "A conflict of interest occurs when personal interests interfere with professional responsibilities.",
        order: 0,
      },
      {
        id: QQ(2, 2),
        question: "When should you use the whistleblower policy?",
        options: [
          "When you disagree with a business strategy",
          "When you want a pay raise",
          "When you witness illegal activity or serious misconduct",
          "When a project deadline is missed",
        ],
        correctIdx: 2,
        explanation: "The whistleblower policy is for reporting genuine illegal activity or serious ethical violations.",
        order: 1,
      },
      {
        id: QQ(2, 3),
        question: "Company confidential information may be shared:",
        options: [
          "With family members who work in the same industry",
          "On personal social media if no company name is mentioned",
          "Only on a need-to-know basis with authorised personnel",
          "With competitors to build goodwill",
        ],
        correctIdx: 2,
        explanation: "Confidential information must only be shared with authorised personnel on a strict need-to-know basis.",
        order: 2,
      },
      {
        id: QQ(2, 4),
        question: "What is the correct response to receiving an unsolicited gift from a vendor?",
        options: [
          "Accept it to avoid offending the vendor",
          "Declare it to your manager and follow the gifts policy",
          "Keep it private to avoid complications",
          "Return it only if it is worth more than ₹10,000",
        ],
        correctIdx: 1,
        explanation: "All gifts from vendors must be declared regardless of value, per the anti-corruption policy.",
        order: 3,
      },
    ],
  },
  {
    id: QUIZ_IDS.dataProtection,
    videoId: VID_IDS[3],   // Data Protection video
    passMark: 80,
    questions: [
      {
        id: QQ(3, 1),
        question: "Under GDPR, what is the maximum timeframe to report a personal data breach to the regulator?",
        options: [
          "24 hours",
          "48 hours",
          "72 hours",
          "7 days",
        ],
        correctIdx: 2,
        explanation: "GDPR requires breach notification to the supervisory authority within 72 hours of becoming aware.",
        order: 0,
      },
      {
        id: QQ(3, 2),
        question: "Which of the following is NOT a valid lawful basis for processing personal data?",
        options: [
          "Consent",
          "Legitimate interests",
          "Business curiosity",
          "Legal obligation",
        ],
        correctIdx: 2,
        explanation: "GDPR Article 6 lists 6 lawful bases. Business curiosity is not among them.",
        order: 1,
      },
      {
        id: QQ(3, 3),
        question: "A colleague asks you to email customer records to their personal Gmail. You should:",
        options: [
          "Send it immediately to be helpful",
          "Refuse — personal email does not meet data security standards",
          "Send it if the customer has given verbal consent",
          "Ask your IT team to compress the file first",
        ],
        correctIdx: 1,
        explanation: "Personal email accounts do not meet the security standards required for personal data transfers.",
        order: 2,
      },
      {
        id: QQ(3, 4),
        question: "What does 'data minimisation' mean under GDPR?",
        options: [
          "Collecting as much data as possible for future use",
          "Deleting data after 30 days regardless of purpose",
          "Collecting only the data necessary for the specified purpose",
          "Minimising the number of employees who handle data",
        ],
        correctIdx: 2,
        explanation: "Data minimisation means you should only collect and process data that is adequate and relevant to the purpose.",
        order: 3,
      },
    ],
  },
];

// ─── Logging helpers ──────────────────────────────────────────────────────────

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
};

const log = {
  info:    (msg) => console.log(`  ${colors.blue}ℹ${colors.reset} ${msg}`),
  ok:      (msg) => console.log(`  ${colors.green}✓${colors.reset} ${msg}`),
  warn:    (msg) => console.log(`  ${colors.yellow}⚠${colors.reset} ${msg}`),
  error:   (msg) => console.log(`  ${colors.red}✗${colors.reset} ${msg}`),
  section: (msg) => console.log(`\n${colors.bold}${colors.cyan}▶ ${msg}${colors.reset}`),
  dim:     (msg) => console.log(`  ${colors.dim}${msg}${colors.reset}`),
};

// ─── Clean ────────────────────────────────────────────────────────────────────

async function cleanSeedData() {
  log.section("Cleaning seed data…");

  // Quiz attempts
  const qa = await pool.query(
    `DELETE FROM "VideoQuizAttempt" WHERE "staffId" LIKE 'seed-%' RETURNING id`
  );
  log.ok(`Deleted ${qa.rowCount} quiz attempts`);

  // Quiz questions (cascade from quiz)
  // Delete quizzes by known video IDs
  const qIds = Object.values(QUIZ_IDS).map((_, i) => `$${i + 1}`).join(",");
  const qq = await pool.query(
    `DELETE FROM "VideoQuiz" WHERE id IN (${qIds}) RETURNING id`,
    Object.values(QUIZ_IDS)
  );
  log.ok(`Deleted ${qq.rowCount} quizzes (questions cascade)`);

  // Watch logs
  const wl = await pool.query(
    `DELETE FROM "VideoWatchLog" WHERE "staffId" LIKE 'seed-%' RETURNING id`
  );
  log.ok(`Deleted ${wl.rowCount} watch logs`);

  // Acknowledgements
  const ack = await pool.query(
    `DELETE FROM "DocAcknowledgement" WHERE "staffId" LIKE 'seed-%' RETURNING id`
  );
  log.ok(`Deleted ${ack.rowCount} acknowledgements`);

  // Videos
  const vidPlaceholders = VID_IDS.map((_, i) => `$${i + 1}`).join(",");
  const vids = await pool.query(
    `DELETE FROM "HrVideo" WHERE id::text IN (${vidPlaceholders}) RETURNING id`,
    VID_IDS
  );
  log.ok(`Deleted ${vids.rowCount} videos`);

  // Documents
  const docPlaceholders = DOC_IDS.map((_, i) => `$${i + 1}`).join(",");
  const docs = await pool.query(
    `DELETE FROM "HrDocument" WHERE id::text IN (${docPlaceholders}) RETURNING id`,
    DOC_IDS
  );
  log.ok(`Deleted ${docs.rowCount} documents`);

  // Staff
  const staff = await pool.query(
    `DELETE FROM "Staff" WHERE email LIKE '%${SEED_EMAIL_SUFFIX}' RETURNING id`
  );
  log.ok(`Deleted ${staff.rowCount} staff records`);
}

// ─── Seed Staff ───────────────────────────────────────────────────────────────

async function seedStaff() {
  log.section("Seeding Staff (8 users)…");
  let created = 0, skipped = 0;

  for (const s of Object.values(STAFF)) {
    const existing = await pool.query(`SELECT id FROM "Staff" WHERE email = $1`, [s.email]);
    if (existing.rowCount > 0) {
      log.dim(`  SKIP  ${s.firstName} ${s.lastName} (${s.role})`);
      skipped++;
    } else {
      await pool.query(
        `INSERT INTO "Staff" (id, "firstName", "lastName", email, phone, role, department, status, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', NOW(), NOW())`,
        [s.id, s.firstName, s.lastName, s.email, "+91 99000 " + s.id.slice(-5), s.role, s.dept]
      );
      log.ok(`  ${s.role.padEnd(7)} ${s.firstName} ${s.lastName} (${s.email})`);
      created++;
    }
  }

  log.info(`Staff: ${created} created, ${skipped} skipped`);
}

// ─── Seed Documents ───────────────────────────────────────────────────────────

async function seedDocuments() {
  log.section("Seeding Documents (16 records)…");

  // Ensure warningLevel column exists (idempotent)
  await pool.query(
    `ALTER TABLE "HrDocument" ADD COLUMN IF NOT EXISTS "warningLevel" TEXT NOT NULL DEFAULT 'none'`
  ).catch(() => {});

  const samplePdfUrl = "https://www.africau.edu/images/default/sample.pdf";
  let created = 0;

  for (const doc of DOCUMENTS) {
    const status = doc.status || "ACTIVE";

    // Compute warningLevel
    let warningLevel = "none";
    if (status === "ACTIVE" && doc.expiresAt) {
      const days = Math.ceil((new Date(doc.expiresAt).getTime() - Date.now()) / 86400000);
      if (days <= 7)   warningLevel = "high";
      else if (days <= 30) warningLevel = "medium";
      else if (days <= 90) warningLevel = "low";
    }

    await pool.query(
      `INSERT INTO "HrDocument" (
         id, title, description, category,
         "fileUrl", "fileKey", "fileType", "fileSize",
         version, "isLatest", "accessLevel", "allowedRoles", "allowedStaff",
         tags, metadata, "requiresAck", "expiresAt",
         status, "warningLevel", "uploadedBy", "isDeleted", "createdAt", "updatedAt"
       ) VALUES (
         $1,  $2,  $3,  $4,
         $5,  $6,  'application/pdf', 204800,
         1,   true, $7,  '{}', '{}',
         $8,  '{}', $9,  $10,
         $11, $12, $13,  false, $14, $14
       )
       ON CONFLICT (id) DO UPDATE SET
         title         = EXCLUDED.title,
         status        = EXCLUDED.status,
         "warningLevel"= EXCLUDED."warningLevel",
         "updatedAt"   = NOW()`,
      [
        doc.id,
        doc.title,
        doc.description,
        doc.category,
        samplePdfUrl,
        `vault/docs/seed_${doc.id}`,
        doc.accessLevel,
        `{${(doc.tags || []).join(",")}}`,
        doc.requiresAck,
        doc.expiresAt || null,
        status,
        warningLevel,
        SEED_MARKER,
        daysAgo(Math.floor(Math.random() * 30)),
      ]
    );

    const wlLabel = warningLevel === "high"   ? "🔴 HIGH"
                  : warningLevel === "medium" ? "🟠 MED"
                  : warningLevel === "low"    ? "🟡 LOW"
                  : status === "EXPIRED"      ? "❌ EXPD"
                  :                            "✅ SAFE";
    log.ok(`  [${wlLabel}] ${doc.title.substring(0, 55)}`);
    created++;
  }

  log.info(`Documents: ${created} upserted`);
}

// ─── Seed Acknowledgements ────────────────────────────────────────────────────

async function seedAcknowledgements() {
  log.section("Seeding Acknowledgements…");

  // Docs that require ack
  const ackDocs = DOCUMENTS.filter((d) => d.requiresAck && d.status !== "EXPIRED");

  const ackPairs = [
    // Admin acknowledges everything
    { staffId: STAFF.admin.id, docIds: ackDocs.map((d) => d.id) },
    // Mgr1 acknowledges most
    { staffId: STAFF.mgr1.id, docIds: ackDocs.filter((_, i) => i % 2 === 0).map((d) => d.id) },
    // Emp1 acknowledges some
    { staffId: STAFF.emp1.id, docIds: ackDocs.filter((_, i) => i < 3).map((d) => d.id) },
    // Emp2 acknowledges 1 (pending on others)
    { staffId: STAFF.emp2.id, docIds: [ackDocs[0]?.id].filter(Boolean) },
    // Emp3, emp4, emp5 — no acknowledgements yet (pending)
  ];

  let created = 0;
  for (const { staffId, docIds } of ackPairs) {
    for (const docId of docIds) {
      if (!docId) continue;
      await pool.query(
        `INSERT INTO "DocAcknowledgement" (
           id, "documentId", "staffId", "acknowledgedAt",
           "ipAddress", "userAgent", signature, notes, "isDeleted", "createdAt", "updatedAt"
         ) VALUES (
           gen_random_uuid(), $1, $2, $3,
           '192.168.1.100', 'Mozilla/5.0 (Seed)', $4, 'Acknowledged via seed script',
           false, NOW(), NOW()
         )
         ON CONFLICT ("documentId", "staffId") DO NOTHING`,
        [
          docId,
          staffId,
          daysAgo(Math.floor(Math.random() * 14)),
          `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`,
        ]
      );
      created++;
    }
  }

  log.info(`Acknowledgements: ${created} records created`);
  log.dim("  Pending: emp3, emp4, emp5 have NOT acknowledged any docs (test pending state)");
}

// ─── Seed Videos ──────────────────────────────────────────────────────────────

async function seedVideos() {
  log.section("Seeding Videos (9 records)…");
  let created = 0;

  for (let i = 0; i < VIDEOS.length; i++) {
    const v = VIDEOS[i];
    await pool.query(
      `INSERT INTO "HrVideo" (
         id, title, description, category,
         "originalUrl", "processedUrl", "thumbnailUrl", "fileKey",
         "fileSize", duration, status, "accessLevel",
         "allowedRoles", "allowedStaff", tags, metadata,
         "isRequired", "expiresAt", "uploadedBy", "isDeleted", "createdAt", "updatedAt"
       ) VALUES (
         $1, $2, $3, $4,
         $5, $6, $7, $8,
         $9, $10, $11, $12,
         '{}', '{}', $13, '{}',
         $14, $15, $16, false, $17, $17
       )
       ON CONFLICT (id) DO UPDATE SET
         title        = EXCLUDED.title,
         status       = EXCLUDED.status,
         "updatedAt"  = NOW()`,
      [
        v.id,
        v.title,
        v.description,
        v.category,
        SAMPLE_VIDEOS[i] || SAMPLE_VIDEOS[0],
        v.status === "READY" ? SAMPLE_VIDEOS[i] || SAMPLE_VIDEOS[0] : null,
        null,  // no thumbnail for seed
        `vault/videos/seed_${v.id}`,
        500 * 1024 * 1024,  // 500MB placeholder
        v.duration,
        v.status,
        v.accessLevel,
        `{${(v.tags || []).join(",")}}`,
        v.isRequired,
        null,
        SEED_MARKER,
        daysAgo(Math.floor(Math.random() * 60)),
      ]
    );

    const reqLabel = v.isRequired ? "⭐ Required" : "        ";
    const statusLabel = v.status === "READY" ? "READY" : "⏳ PROCESSING";
    log.ok(`  [${statusLabel}] ${reqLabel} ${v.title.substring(0, 50)}`);
    created++;
  }

  log.info(`Videos: ${created} upserted`);
}

// ─── Seed Watch Logs ──────────────────────────────────────────────────────────

async function seedWatchLogs() {
  log.section("Seeding Video Watch Logs…");

  // Scenario matrix: staffId → [{videoIdx, watchedPct}]
  const watchScenarios = [
    // Admin watched several fully
    { staffId: STAFF.admin.id, videos: [
      { idx: 0, pct: 100 },  // Onboarding — completed
      { idx: 1, pct: 100 },  // Fire Safety — completed
      { idx: 2, pct: 92 },   // Ethics — completed (>90%)
      { idx: 4, pct: 45 },   // Teams — in progress
    ]},
    // Manager1 — in progress on several
    { staffId: STAFF.mgr1.id, videos: [
      { idx: 0, pct: 100 },
      { idx: 1, pct: 55 },   // Fire safety — watching
      { idx: 5, pct: 20 },   // DEI — just started
    ]},
    // Employee1 — required not done
    { staffId: STAFF.emp1.id, videos: [
      { idx: 0, pct: 78 },   // Onboarding — almost done
      { idx: 3, pct: 95 },   // GDPR — completed
      { idx: 6, pct: 10 },   // Product — just started
    ]},
    // Employee2 — barely watched
    { staffId: STAFF.emp2.id, videos: [
      { idx: 0, pct: 15 },   // Onboarding — just started
      { idx: 1, pct: 0 },    // Fire safety — not started
    ]},
    // Employee3 — completed mandatory, skipped others
    { staffId: STAFF.emp3.id, videos: [
      { idx: 1, pct: 100 },  // Fire safety — done
      { idx: 2, pct: 100 },  // Ethics — done
      { idx: 8, pct: 50 },   // First aid — halfway
    ]},
  ];

  let created = 0;
  for (const { staffId, videos } of watchScenarios) {
    for (const { idx, pct } of videos) {
      const v = VIDEOS[idx];
      if (!v || v.status !== "READY") continue;

      const dur    = v.duration || 1800;
      const watched = Math.floor((pct / 100) * dur);
      const completed = pct >= 90;

      await pool.query(
        `INSERT INTO "VideoWatchLog" (
           id, "videoId", "staffId",
           "watchedSeconds", "totalSeconds", percentage, completed,
           "lastPosition", "sessionData", "isDeleted", "createdAt", "updatedAt"
         ) VALUES (
           gen_random_uuid(), $1, $2,
           $3, $4, $5, $6,
           $7, '{}', false, $8, $8
         )
         ON CONFLICT ("videoId", "staffId") DO UPDATE SET
           "watchedSeconds" = EXCLUDED."watchedSeconds",
           percentage       = EXCLUDED.percentage,
           completed        = EXCLUDED.completed,
           "lastPosition"   = EXCLUDED."lastPosition",
           "updatedAt"      = NOW()`,
        [
          v.id,
          staffId,
          watched,
          dur,
          pct,
          completed,
          watched,
          daysAgo(Math.floor(Math.random() * 7)),
        ]
      );
      created++;
    }
  }

  log.info(`Watch logs: ${created} records upserted`);
}

// ─── Seed Quizzes ─────────────────────────────────────────────────────────────

async function seedQuizzes() {
  log.section("Seeding Quizzes + Attempts…");

  for (const quiz of QUIZZES) {
    // Insert quiz
    await pool.query(
      `INSERT INTO "VideoQuiz" (id, "videoId", "passMark", "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, true, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET "passMark" = EXCLUDED."passMark", "updatedAt" = NOW()`,
      [quiz.id, quiz.videoId, quiz.passMark]
    );

    // Insert questions
    for (const q of quiz.questions) {
      await pool.query(
        `INSERT INTO "VideoQuizQuestion" (id, "quizId", question, options, "correctIdx", explanation, "order")
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           question    = EXCLUDED.question,
           options     = EXCLUDED.options,
           "correctIdx"= EXCLUDED."correctIdx",
           explanation = EXCLUDED.explanation`,
        [
          q.id,
          quiz.id,
          q.question,
          JSON.stringify(q.options),
          q.correctIdx,
          q.explanation,
          q.order,
        ]
      );
    }

    log.ok(`  Quiz "${VIDEOS.find((v) => v.id === quiz.videoId)?.title?.substring(0, 40)}" — ${quiz.questions.length}q, pass ${quiz.passMark}%`);
  }

  // Seed attempts
  log.section("Seeding Quiz Attempts…");
  let created = 0;

  const attempts = [
    // Fire Safety — emp1: PASS (all correct)
    {
      quizId: QUIZ_IDS.fireSafety,
      videoId: VID_IDS[1],
      staffId: STAFF.emp1.id,
      answers: buildAnswers(QUIZZES[0].questions, "correct"),
      label: "emp1 → Fire Safety: PASS",
    },
    // Fire Safety — emp2: FAIL (all wrong)
    {
      quizId: QUIZ_IDS.fireSafety,
      videoId: VID_IDS[1],
      staffId: STAFF.emp2.id,
      answers: buildAnswers(QUIZZES[0].questions, "wrong"),
      label: "emp2 → Fire Safety: FAIL",
    },
    // Fire Safety — admin: PASS
    {
      quizId: QUIZ_IDS.fireSafety,
      videoId: VID_IDS[1],
      staffId: STAFF.admin.id,
      answers: buildAnswers(QUIZZES[0].questions, "correct"),
      label: "admin → Fire Safety: PASS",
    },
    // Ethics — mgr1: PASS (75% = 3/4 correct)
    {
      quizId: QUIZ_IDS.workplaceEthics,
      videoId: VID_IDS[2],
      staffId: STAFF.mgr1.id,
      answers: buildAnswers(QUIZZES[1].questions, "mostly-correct"),
      label: "mgr1 → Ethics: PASS (75%)",
    },
    // Ethics — emp3: FAIL (50% = 2/4 correct)
    {
      quizId: QUIZ_IDS.workplaceEthics,
      videoId: VID_IDS[2],
      staffId: STAFF.emp3.id,
      answers: buildAnswers(QUIZZES[1].questions, "half"),
      label: "emp3 → Ethics: FAIL (50%)",
    },
    // Data Protection — emp4: PASS (100%)
    {
      quizId: QUIZ_IDS.dataProtection,
      videoId: VID_IDS[3],
      staffId: STAFF.emp4.id,
      answers: buildAnswers(QUIZZES[2].questions, "correct"),
      label: "emp4 → DataProtection: PASS",
    },
    // Data Protection — emp5: FAIL (75% < 80% pass mark)
    {
      quizId: QUIZ_IDS.dataProtection,
      videoId: VID_IDS[3],
      staffId: STAFF.emp5.id,
      answers: buildAnswers(QUIZZES[2].questions, "mostly-correct"),
      label: "emp5 → DataProtection: FAIL (75% < 80%)",
    },
    // Note: emp3, emp4, emp5 have NOT attempted Fire Safety (test 'not attempted' state)
  ];

  for (const a of attempts) {
    const quiz = QUIZZES.find((q) => q.id === a.quizId);
    const totalQ = quiz.questions.length;
    const correctCount = quiz.questions.reduce((acc, q) => {
      return acc + (a.answers[q.id] === q.correctIdx ? 1 : 0);
    }, 0);
    const score = (correctCount / totalQ) * 100;
    const passed = score >= quiz.passMark;

    await pool.query(
      `INSERT INTO "VideoQuizAttempt" (id, "quizId", "videoId", "staffId", answers, score, passed, "attemptedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)`,
      [
        a.quizId,
        a.videoId,
        a.staffId,
        JSON.stringify(a.answers),
        score,
        passed,
        daysAgo(Math.floor(Math.random() * 10)),
      ]
    );

    const icon = passed ? "✅ PASS" : "❌ FAIL";
    log.ok(`  [${icon} ${Math.round(score)}%] ${a.label}`);
    created++;
  }

  log.info(`Quizzes: 3 quizzes, ${QUIZZES.reduce((a, q) => a + q.questions.length, 0)} questions, ${created} attempts`);
}

/** Build answer map for a quiz — strategy: correct | wrong | mostly-correct | half */
function buildAnswers(questions, strategy) {
  const answers = {};
  questions.forEach((q, i) => {
    if (strategy === "correct") {
      answers[q.id] = q.correctIdx;
    } else if (strategy === "wrong") {
      answers[q.id] = (q.correctIdx + 1) % 4;
    } else if (strategy === "mostly-correct") {
      // Last question wrong, rest correct
      answers[q.id] = (i === questions.length - 1)
        ? (q.correctIdx + 1) % 4
        : q.correctIdx;
    } else if (strategy === "half") {
      // Even-indexed correct, odd-indexed wrong
      answers[q.id] = (i % 2 === 0) ? q.correctIdx : (q.correctIdx + 1) % 4;
    }
  });
  return answers;
}

// ─── Verify ───────────────────────────────────────────────────────────────────

async function verifyCounts() {
  log.section("Database Counts (seed data)…");

  const queries = [
    [`Staff (seed)`,                `SELECT COUNT(*) FROM "Staff" WHERE email LIKE '%${SEED_EMAIL_SUFFIX}'`],
    [`Documents (all)`,             `SELECT COUNT(*) FROM "HrDocument" WHERE "uploadedBy" = '${SEED_MARKER}'`],
    [`  → ACTIVE`,                  `SELECT COUNT(*) FROM "HrDocument" WHERE "uploadedBy" = '${SEED_MARKER}' AND status = 'ACTIVE'`],
    [`  → EXPIRED`,                 `SELECT COUNT(*) FROM "HrDocument" WHERE "uploadedBy" = '${SEED_MARKER}' AND status = 'EXPIRED'`],
    [`  → warningLevel HIGH`,       `SELECT COUNT(*) FROM "HrDocument" WHERE "uploadedBy" = '${SEED_MARKER}' AND "warningLevel" = 'high'`],
    [`  → warningLevel MEDIUM`,     `SELECT COUNT(*) FROM "HrDocument" WHERE "uploadedBy" = '${SEED_MARKER}' AND "warningLevel" = 'medium'`],
    [`  → warningLevel LOW`,        `SELECT COUNT(*) FROM "HrDocument" WHERE "uploadedBy" = '${SEED_MARKER}' AND "warningLevel" = 'low'`],
    [`Acknowledgements (seed)`,     `SELECT COUNT(*) FROM "DocAcknowledgement" WHERE "staffId" LIKE 'seed-%'`],
    [`Videos`,                      `SELECT COUNT(*) FROM "HrVideo" WHERE "uploadedBy" = '${SEED_MARKER}'`],
    [`Watch Logs (seed)`,           `SELECT COUNT(*) FROM "VideoWatchLog" WHERE "staffId" LIKE 'seed-%'`],
    [`  → Completed`,               `SELECT COUNT(*) FROM "VideoWatchLog" WHERE "staffId" LIKE 'seed-%' AND completed = true`],
    [`Quizzes`,                     `SELECT COUNT(*) FROM "VideoQuiz"`],
    [`Quiz Questions`,              `SELECT COUNT(*) FROM "VideoQuizQuestion"`],
    [`Quiz Attempts (seed)`,        `SELECT COUNT(*) FROM "VideoQuizAttempt" WHERE "staffId" LIKE 'seed-%'`],
    [`  → Passed`,                  `SELECT COUNT(*) FROM "VideoQuizAttempt" WHERE "staffId" LIKE 'seed-%' AND passed = true`],
    [`  → Failed`,                  `SELECT COUNT(*) FROM "VideoQuizAttempt" WHERE "staffId" LIKE 'seed-%' AND passed = false`],
  ];

  for (const [label, sql] of queries) {
    try {
      const r = await pool.query(sql);
      const count = parseInt(r.rows[0].count, 10);
      const prefix = label.startsWith("  →") ? "    " : "  ";
      console.log(`  ${colors.dim}${label.padEnd(35)}${colors.reset}${colors.bold}${count}${colors.reset}`);
    } catch {
      log.warn(`${label} — table not found (run seed first?)`);
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const doClean  = args.includes("--clean") || args.includes("--reset");
  const doSeed   = !args.includes("--clean") || args.includes("--reset");
  const doVerify = args.includes("--verify") || args.includes("--reset");

  console.log(`\n${colors.bold}${colors.cyan}═══════════════════════════════════════════`);
  console.log(`  ASKworX Module 7 — Seed Script`);
  console.log(`═══════════════════════════════════════════${colors.reset}`);
  console.log(`  Mode: ${doClean ? "CLEAN " : ""}${doSeed ? "SEED" : ""}${doVerify ? " + VERIFY" : ""}\n`);

  try {
    await pool.query("SELECT 1");
    log.ok("Database connected\n");
  } catch (err) {
    log.error("Database connection failed: " + err.message);
    log.error("Check DATABASE_URL in .env");
    process.exit(1);
  }

  if (doClean) {
    await cleanSeedData();
  }

  if (doSeed) {
    await seedStaff();
    await seedDocuments();
    await seedAcknowledgements();
    await seedVideos();
    await seedWatchLogs();
    await seedQuizzes();
  }

  if (doVerify) {
    await verifyCounts();
  }

  console.log(`\n${colors.bold}${colors.green}✓ Done!${colors.reset}\n`);

  if (doSeed) {
    console.log(`${colors.bold}Test Accounts Created:${colors.reset}`);
    console.log(`  ${colors.cyan}Admin   ${colors.reset}arjun.mehta@vault-seed.test   (ID: seed-admin-001)`);
    console.log(`  ${colors.cyan}Manager ${colors.reset}priya.sharma@vault-seed.test  (ID: seed-mgr-001)`);
    console.log(`  ${colors.cyan}Employee${colors.reset}divya.nair@vault-seed.test    (ID: seed-emp-001)`);
    console.log(`\n  JWT Secret: ${process.env.JWT_SECRET ? "(set)" : colors.red + "MISSING — set JWT_SECRET in .env" + colors.reset}`);
  }

  console.log();
  await pool.end();
}

main().catch((err) => {
  console.error("\n" + colors.red + "Fatal error: " + err.message + colors.reset);
  console.error(err.stack);
  pool.end();
  process.exit(1);
});
