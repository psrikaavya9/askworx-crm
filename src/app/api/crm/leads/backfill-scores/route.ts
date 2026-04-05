/**
 * POST /api/crm/leads/backfill-scores
 *
 * Computes and persists a LeadScore for every lead that currently has none.
 * Safe to call multiple times — only unscored leads are processed.
 *
 * Response:
 *   { processed: number, errors: number }
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeAndSave } from "@/modules/crm/services/scoring.service";

const BATCH_SIZE = 50;

export async function POST() {
  // Fetch all lead IDs that have no LeadScore row yet
  const unscored = await prisma.lead.findMany({
    where:  { score: { is: null } },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  let processed = 0;
  let errors    = 0;

  // Process in small batches to avoid overwhelming the DB
  for (let i = 0; i < unscored.length; i += BATCH_SIZE) {
    const batch = unscored.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(({ id }) =>
        computeAndSave(id).then(() => { processed++; }).catch((err) => {
          console.error(`[backfill-scores] Failed for lead ${id}:`, err);
          errors++;
        }),
      ),
    );
  }

  return NextResponse.json({ processed, errors });
}
