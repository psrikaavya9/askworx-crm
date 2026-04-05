#!/usr/bin/env ts-node
/**
 * =============================================================================
 * fix-invoice-clients.ts — Round-robin invoice → client redistribution
 * =============================================================================
 *
 * PROBLEM:  All invoices share the same clientId (data entry error).
 * SOLUTION: Redistribute invoices across all available clients in round-robin
 *           order (by invoice.createdAt) so the data is varied and meaningful.
 *
 * Usage (from project root):
 *   npx ts-node --project scripts/tsconfig.scripts.json scripts/fix-invoice-clients.ts
 *
 * Flags:
 *   --dry-run   Preview the assignments without writing to the database
 *   --verify    Only read + print current state (no writes at all)
 *
 * Safety:
 *   • All updates run inside a single Prisma interactive transaction.
 *   • If any single update fails the entire transaction is rolled back —
 *     no partial state is ever committed.
 *   • No rows are deleted.
 *   • Schema is not touched.
 * =============================================================================
 */

import "dotenv/config";
import { Pool }        from "pg";
import { PrismaPg }    from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const pool    = new Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma  = new PrismaClient({ adapter } as never);

// ---------------------------------------------------------------------------
// CLI flag parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const DRY_RUN  = args.includes("--dry-run");
const VERIFY   = args.includes("--verify");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clientLabel(c: { id: string; firstName: string; lastName: string; company: string }) {
  return `${c.firstName} ${c.lastName} (${c.company}) [${c.id}]`;
}

// ---------------------------------------------------------------------------
// Verify mode — read-only, print current state
// ---------------------------------------------------------------------------

async function verify() {
  console.log("\n=== VERIFY: current invoice → client mapping ===\n");

  const invoices = await prisma.invoice.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id:            true,
      invoiceNumber: true,
      clientId:      true,
      client:        { select: { id: true, firstName: true, lastName: true, company: true } },
      createdAt:     true,
    },
  });

  if (invoices.length === 0) {
    console.log("No invoices found.");
    return;
  }

  // Count unique clientIds actually assigned
  const uniqueClientIds = new Set(invoices.map((inv) => inv.clientId).filter(Boolean));

  console.log(`Total invoices : ${invoices.length}`);
  console.log(`Unique clientIds in use: ${uniqueClientIds.size}\n`);

  invoices.forEach((inv, i) => {
    const clientInfo = inv.client
      ? clientLabel(inv.client)
      : `(null — no client assigned)`;
    console.log(`  [${String(i + 1).padStart(3)}] ${inv.invoiceNumber.padEnd(20)} → ${clientInfo}`);
  });

  console.log("\n=== END VERIFY ===\n");
}

// ---------------------------------------------------------------------------
// Main fix
// ---------------------------------------------------------------------------

async function fixInvoiceClients() {
  console.log("\n=== fix-invoice-clients ===");
  if (DRY_RUN) console.log("    (DRY RUN — no writes will be made)\n");

  // ── Step 1: Fetch all clients ───────────────────────────────────────────────
  const clients = await prisma.client.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, firstName: true, lastName: true, company: true },
  });

  if (clients.length === 0) {
    console.error("✗ No clients found in the database. Cannot redistribute invoices.");
    process.exit(1);
  }

  console.log(`Clients found : ${clients.length}`);
  clients.forEach((c, i) => console.log(`  [${i + 1}] ${clientLabel(c)}`));

  // ── Step 2: Fetch all invoices ordered by createdAt ─────────────────────────
  const invoices = await prisma.invoice.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, invoiceNumber: true, clientId: true, createdAt: true },
  });

  if (invoices.length === 0) {
    console.log("\nNo invoices found. Nothing to fix.");
    return;
  }

  console.log(`\nInvoices found: ${invoices.length}`);

  // ── Step 3: Build round-robin assignment plan ───────────────────────────────
  const plan: Array<{ invoiceId: string; invoiceNumber: string; newClientId: string; oldClientId: string | null }> = [];

  invoices.forEach((invoice, index) => {
    const assignedClient = clients[index % clients.length];
    plan.push({
      invoiceId:     invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      newClientId:   assignedClient.id,
      oldClientId:   invoice.clientId,
    });
  });

  // ── Step 4: Print preview ───────────────────────────────────────────────────
  console.log("\n--- Assignment plan ---");
  plan.forEach((entry, i) => {
    const client = clients.find((c) => c.id === entry.newClientId)!;
    const changed = entry.oldClientId !== entry.newClientId ? " ← CHANGING" : " (unchanged)";
    console.log(
      `  [${String(i + 1).padStart(3)}] ${entry.invoiceNumber.padEnd(20)} → ${clientLabel(client)}${changed}`,
    );
  });

  const changedCount = plan.filter((e) => e.oldClientId !== e.newClientId).length;
  console.log(`\n  ${changedCount} of ${plan.length} invoices will be updated.\n`);

  if (DRY_RUN) {
    console.log("DRY RUN complete. No changes written.");
    return;
  }

  if (changedCount === 0) {
    console.log("All invoices already have the correct clientId. Nothing to update.");
    return;
  }

  // ── Step 5: Apply updates inside a transaction ──────────────────────────────
  console.log("Applying updates inside a transaction...");

  await prisma.$transaction(async (tx) => {
    for (const entry of plan) {
      if (entry.oldClientId === entry.newClientId) continue; // skip no-ops

      await tx.invoice.update({
        where: { id: entry.invoiceId },
        data:  { clientId: entry.newClientId },
      });

      const client = clients.find((c) => c.id === entry.newClientId)!;
      console.log(`  ✓ ${entry.invoiceNumber.padEnd(20)} → ${clientLabel(client)}`);
    }
  });

  console.log(`\n✓ Transaction committed. ${changedCount} invoices updated.`);

  // ── Step 6: Post-update verification ───────────────────────────────────────
  console.log("\n--- Post-update verification ---");
  await verify();
}

// ---------------------------------------------------------------------------
// Entrypoint
// ---------------------------------------------------------------------------

async function main() {
  try {
    if (VERIFY) {
      await verify();
    } else {
      await fixInvoiceClients();
    }
  } catch (err) {
    console.error("\n✗ Script failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
