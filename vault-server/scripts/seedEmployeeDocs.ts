/**
 * seedEmployeeDocs.ts
 *
 * Seeds three test HrDocument rows to verify employee-specific document
 * visibility logic.
 *
 * Run from vault-server directory:
 *   npx ts-node -r dotenv/config scripts/seedEmployeeDocs.ts
 *
 * Test users (fixed IDs used as employeeId — matches JWT sub values):
 *   ADMIN  → sub: "admin-001"   role: ADMIN
 *   EMP1   → sub: "emp-001"     role: STAFF
 *   EMP2   → sub: "emp-002"     role: STAFF
 *
 * To test as EMP1 / EMP2, set these env vars in the Next.js .env.local:
 *   VAULT_TEST_SUB=emp-001
 *   VAULT_TEST_ROLE=STAFF
 *   VAULT_TEST_EMAIL=emp1@askworx.com
 * Then restart the Next.js dev server so /api/vault/token picks them up.
 */

import "dotenv/config";
import { Pool } from "pg";
import { v4 as uuidv4 } from "uuid";

// ---------------------------------------------------------------------------
// DB connection
// ---------------------------------------------------------------------------

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ---------------------------------------------------------------------------
// Fixed test IDs  (stable across re-runs — used for UPSERT ON CONFLICT)
// ---------------------------------------------------------------------------

const DOCS = [
  {
    id:          "seed-doc-company-policy-001",
    title:       "Company Policy",
    description: "General company policy applicable to all staff",
    category:    "POLICY",
    employeeId:  null,                     // shared — visible to everyone
  },
  {
    id:          "seed-doc-emp1-offer-001",
    title:       "Emp1 Offer Letter",
    description: "Offer letter for employee 1 (emp-001)",
    category:    "CONTRACT",
    employeeId:  "emp-001",               // only visible to emp-001 + ADMIN
  },
  {
    id:          "seed-doc-emp2-warning-001",
    title:       "Emp2 Warning Letter",
    description: "Warning letter for employee 2 (emp-002)",
    category:    "COMPLIANCE",
    employeeId:  "emp-002",               // only visible to emp-002 + ADMIN
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function ensureEmployeeIdColumn(): Promise<void> {
  await pool.query(`
    ALTER TABLE "HrDocument"
    ADD COLUMN IF NOT EXISTS "employeeId" TEXT
  `);
  console.log('[seed] ✓ "employeeId" column ensured');
}

async function upsertDoc(doc: typeof DOCS[number]): Promise<void> {
  // Use a stable slug as the fileKey so we can detect existing rows
  const fileKey = `seed/${doc.id}`;

  await pool.query(`
    INSERT INTO "HrDocument" (
      id, title, description, category,
      "fileUrl", "fileKey", "fileType", "fileSize",
      version, "isLatest",
      "accessLevel", "allowedRoles", "allowedStaff",
      tags, metadata, "requiresAck", status,
      "uploadedBy", "employeeId"
    ) VALUES (
      $1,  $2,  $3,  $4,
      $5,  $6,  'application/pdf', 0,
      1,   true,
      'ALL', '{}', '{}',
      '{}', '{}', false, 'ACTIVE',
      'admin-001', $7
    )
    ON CONFLICT (id) DO UPDATE SET
      title        = EXCLUDED.title,
      description  = EXCLUDED.description,
      "employeeId" = EXCLUDED."employeeId",
      "updatedAt"  = NOW()
  `, [
    doc.id,
    doc.title,
    doc.description,
    doc.category,
    `https://placeholder.invalid/${doc.id}.pdf`,
    fileKey,
    doc.employeeId,
  ]);

  console.log(`[seed] ✓ Upserted: "${doc.title}" (employeeId=${doc.employeeId ?? "null"})`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("[seed] Connecting to:", process.env.DATABASE_URL?.replace(/:([^:@]+)@/, ":***@"));

  try {
    await pool.query("SELECT 1");
    console.log("[seed] ✓ Database connected");

    await ensureEmployeeIdColumn();

    for (const doc of DOCS) {
      await upsertDoc(doc);
    }

    console.log("\n[seed] ✓ All test documents seeded successfully");
    console.log("\n─────────────────────────────────────────────────────");
    console.log("EXPECTED VISIBILITY:");
    console.log("  Login as admin-001 (ADMIN)  → sees ALL 3 documents");
    console.log("  Login as emp-001   (STAFF)  → sees Company Policy + Emp1 Offer Letter");
    console.log("  Login as emp-002   (STAFF)  → sees Company Policy + Emp2 Warning Letter");
    console.log("─────────────────────────────────────────────────────");
    console.log("\nTo switch test user, set in Next.js .env.local:");
    console.log("  VAULT_TEST_SUB=emp-001");
    console.log("  VAULT_TEST_ROLE=STAFF");
    console.log("  VAULT_TEST_EMAIL=emp1@askworx.com");
    console.log("Then restart the Next.js dev server.\n");

  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[seed] FAILED:", err);
  process.exit(1);
});
