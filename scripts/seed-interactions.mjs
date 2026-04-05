/**
 * Seed script — CustomerInteraction
 *
 * Inserts 5 test interactions (mix of CALL and VISIT, all pending review).
 *
 * Run:
 *   node scripts/seed-interactions.mjs
 */

import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";

// ---------------------------------------------------------------------------
// Bootstrap — load .env before importing anything that needs DATABASE_URL
// ---------------------------------------------------------------------------

const require   = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// dotenv may not be installed at project root; fall back gracefully
try {
  const dotenv = require("dotenv");
  dotenv.config({ path: path.resolve(__dirname, "../.env") });
} catch {
  // dotenv not available — rely on env vars already set in the shell
}

// ---------------------------------------------------------------------------
// Prisma client
// ---------------------------------------------------------------------------

const { PrismaClient } = await import("../src/generated/prisma/client.js").catch(() =>
  import("../src/generated/prisma/client/index.js")
);
const { Pool }      = await import("pg");
const { PrismaPg }  = await import("@prisma/adapter-pg");

const pool    = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma  = new PrismaClient({ adapter });

// ---------------------------------------------------------------------------
// Seed data
// Hardcoded IDs are the first Client and Staff records in the dev database.
// Change these if your IDs differ.
// ---------------------------------------------------------------------------

const CLIENT_IDS = [
  "cmmp4sv330000dcmh5965udyt", // Sarah Mitchell
  "cmmp4sv480001dcmh48v1q8al", // Daniel Torres
];

const STAFF_IDS = [
  "cmmp8d1o5000szkmh5lnemut1", // Jane Smith
  "cmmp8d1od000tzkmhds6xlrj1", // Michael Brown
  "cmmp8d1ol000uzkmhvtvkcqwh", // Priya Nair
];

const now = new Date();
const daysAgo = (n) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

const RECORDS = [
  {
    clientId:    CLIENT_IDS[0],
    staffId:     STAFF_IDS[0],
    type:        "CALL",
    date:        daysAgo(1),
    duration:    18,
    outcome:     "Demo scheduled for next week",
    notes:       "Client expressed strong interest in the enterprise plan. Follow-up call booked for Thursday.",
    approved:    false,
    rejected:    false,
  },
  {
    clientId:    CLIENT_IDS[0],
    staffId:     STAFF_IDS[1],
    type:        "VISIT",
    date:        daysAgo(3),
    duration:    45,
    outcome:     "Site survey completed",
    notes:       "Visited their Bangalore office. Met with the IT head. Requirements documented and sent to the product team.",
    gpsLat:      12.9716,
    gpsLng:      77.5946,
    approved:    false,
    rejected:    false,
  },
  {
    clientId:    CLIENT_IDS[1],
    staffId:     STAFF_IDS[2],
    type:        "CALL",
    date:        daysAgo(5),
    duration:    9,
    outcome:     "No answer — left voicemail",
    notes:       "Called twice. Left voicemail on second attempt. Will retry tomorrow morning.",
    approved:    false,
    rejected:    false,
  },
  {
    clientId:    CLIENT_IDS[1],
    staffId:     STAFF_IDS[0],
    type:        "VISIT",
    date:        daysAgo(7),
    duration:    60,
    outcome:     "Proposal presented",
    notes:       "Presented Q3 proposal to Daniel and his CFO. Positive reception. They requested a revised pricing sheet by EOD Friday.",
    gpsLat:      19.0760,
    gpsLng:      72.8777,
    approved:    false,
    rejected:    false,
  },
  {
    clientId:    CLIENT_IDS[0],
    staffId:     STAFF_IDS[2],
    type:        "CALL",
    date:        daysAgo(10),
    duration:    25,
    outcome:     "Follow-up scheduled",
    notes:       "Discussed renewal terms. Client is comparing two vendors. Will send competitive comparison doc.",
    nextFollowUp: daysAgo(-3), // 3 days from now
    approved:    false,
    rejected:    false,
  },
];

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

async function main() {
  console.log("🌱  Seeding CustomerInteraction...\n");

  let created = 0;

  for (const record of RECORDS) {
    const row = await prisma.customerInteraction.create({ data: record });
    console.log(
      `  ✓ [${row.type.padEnd(5)}] ${row.outcome}  →  id: ${row.id}`,
    );
    created++;
  }

  console.log(`\n✅  Done — ${created} interactions inserted.`);
  console.log("   All records have approved=false and are ready for owner review at /reviews\n");
}

main()
  .catch((err) => {
    console.error("\n❌  Seed failed:", err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
