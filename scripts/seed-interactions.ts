/**
 * Seed script — CustomerInteraction
 *
 * Inserts 5 test interactions (mix of CALL and VISIT, all pending review).
 *
 * Run:
 *   npx ts-node --project tsconfig.json -e "require('dotenv').config()" scripts/seed-interactions.ts
 *
 * Or with the npm script added in package.json:
 *   npm run seed:interactions
 */

import "dotenv/config";
import { Pool }      from "pg";
import { PrismaPg }  from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const pool    = new Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma  = new PrismaClient({ adapter } as never);

// ---------------------------------------------------------------------------
// Seed data
// IDs are from the dev database — update if your seed data differs.
// ---------------------------------------------------------------------------

const CLIENT_IDS = {
  sarah:  "cmmp4sv330000dcmh5965udyt", // Sarah Mitchell
  daniel: "cmmp4sv480001dcmh48v1q8al", // Daniel Torres
};

const STAFF_IDS = {
  jane:   "cmmp8d1o5000szkmh5lnemut1", // Jane Smith
  michael:"cmmp8d1od000tzkmhds6xlrj1", // Michael Brown
  priya:  "cmmp8d1ol000uzkmhvtvkcqwh", // Priya Nair
};

const now      = new Date();
const daysAgo  = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
const daysFrom = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);

const RECORDS = [
  {
    clientId:    CLIENT_IDS.sarah,
    staffId:     STAFF_IDS.jane,
    type:        "CALL" as const,
    date:        daysAgo(1),
    duration:    18,
    outcome:     "Demo scheduled for next week",
    notes:       "Client expressed strong interest in the enterprise plan. Follow-up call booked for Thursday.",
    approved:    false,
    rejected:    false,
  },
  {
    clientId:    CLIENT_IDS.sarah,
    staffId:     STAFF_IDS.michael,
    type:        "VISIT" as const,
    date:        daysAgo(3),
    duration:    45,
    outcome:     "Site survey completed",
    notes:       "Visited Bangalore office. Met with the IT head. Requirements documented and sent to the product team.",
    gpsLat:      12.9716,
    gpsLng:      77.5946,
    approved:    false,
    rejected:    false,
  },
  {
    clientId:    CLIENT_IDS.daniel,
    staffId:     STAFF_IDS.priya,
    type:        "CALL" as const,
    date:        daysAgo(5),
    duration:    9,
    outcome:     "No answer — left voicemail",
    notes:       "Called twice. Left voicemail on second attempt. Will retry tomorrow morning.",
    approved:    false,
    rejected:    false,
  },
  {
    clientId:    CLIENT_IDS.daniel,
    staffId:     STAFF_IDS.jane,
    type:        "VISIT" as const,
    date:        daysAgo(7),
    duration:    60,
    outcome:     "Proposal presented",
    notes:       "Presented Q3 proposal to Daniel and his CFO. Positive reception. Revised pricing sheet requested by Friday.",
    gpsLat:      19.0760,
    gpsLng:      72.8777,
    approved:    false,
    rejected:    false,
  },
  {
    clientId:    CLIENT_IDS.sarah,
    staffId:     STAFF_IDS.priya,
    type:        "CALL" as const,
    date:        daysAgo(10),
    duration:    25,
    outcome:     "Follow-up scheduled",
    notes:       "Discussed renewal terms. Client comparing two vendors. Will send competitive comparison doc.",
    nextFollowUp: daysFrom(3),
    approved:    false,
    rejected:    false,
  },
];

async function main() {
  console.log("\n🌱  Seeding CustomerInteraction...\n");

  let created = 0;

  for (const record of RECORDS) {
    const row = await (prisma as any).customerInteraction.create({ data: record });
    console.log(`  ✓  [${row.type.padEnd(5)}]  ${row.outcome}`);
    console.log(`         id: ${row.id}  |  client: ${row.clientId}  |  staff: ${row.staffId}\n`);
    created++;
  }

  console.log(`✅  Done — ${created} interactions inserted.`);
  console.log("    All records are pending review (approved=false).");
  console.log("    Visit /reviews to approve, reject, or request edits.\n");
}

main()
  .catch((err: Error) => {
    console.error("\n❌  Seed failed:", err.message);
    process.exit(1);
  })
  .finally(async () => {
    await (prisma as any).$disconnect();
    await pool.end();
  });
