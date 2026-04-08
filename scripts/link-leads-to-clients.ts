/**
 * scripts/link-leads-to-clients.ts
 *
 * For every Lead that has no clientId, creates a Client record from the
 * lead's details and links the lead to it.
 *
 * Safe to re-run — skips any lead that already has a clientId.
 *
 * Run: npx tsx scripts/link-leads-to-clients.ts
 */

import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const pool    = new Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma  = new (PrismaClient as any)({ adapter }) as PrismaClient;

async function main() {
  console.log("🔗 Linking unlinked leads to Client records…\n");

  const unlinked = await prisma.lead.findMany({
    where:  { clientId: null },
    select: {
      id:        true,
      firstName: true,
      lastName:  true,
      email:     true,
      phone:     true,
      company:   true,
      jobTitle:  true,
    },
  });

  console.log(`Found ${unlinked.length} leads without clientId`);
  if (unlinked.length === 0) {
    console.log("✅ Nothing to do.");
    return;
  }

  let created = 0;
  let linked  = 0;
  let failed  = 0;

  for (const lead of unlinked) {
    try {
      // Upsert client by email — handles re-runs gracefully
      const client = await prisma.client.upsert({
        where:  { email: lead.email },
        create: {
          firstName: lead.firstName,
          lastName:  lead.lastName,
          email:     lead.email,
          phone:     lead.phone ?? undefined,
          company:   lead.company ?? `${lead.firstName} ${lead.lastName}`,
          jobTitle:  lead.jobTitle ?? undefined,
        },
        update: {}, // already exists — don't overwrite any manual edits
      });

      // Link lead → client
      await prisma.lead.update({
        where: { id: lead.id },
        data:  { clientId: client.id },
      });

      created++;
      linked++;
      console.log(`  ✓ ${lead.firstName} ${lead.lastName} (${lead.email}) → client ${client.id}`);
    } catch (err) {
      console.error(`  ✗ lead ${lead.id}:`, (err as Error).message);
      failed++;
    }
  }

  console.log(`\n✅ Done: ${created} client records upserted, ${linked} leads linked, ${failed} failed`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect().then(() => pool.end()));
