import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient; _prismaSchemaVersion?: string };

// Schema version — bump this after every `prisma generate` to force singleton recreation.
// This prevents the HMR singleton from holding onto a stale query-validation model.
const SCHEMA_VERSION = "2026-03-31-duplicate-detection"; // bumped after adding DUPLICATE_FLAGGED/LEAD_MERGED enum + phone/name indexes

function createPrismaClient() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const adapter = new PrismaPg(pool);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new (PrismaClient as any)({ adapter }) as PrismaClient;
}

// In dev mode, recreate the client if the schema version changed so that
// `prisma generate` changes take effect without restarting the dev server.
if (process.env.NODE_ENV !== "production" && globalForPrisma._prismaSchemaVersion !== SCHEMA_VERSION) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (globalForPrisma as any).prisma;
  globalForPrisma._prismaSchemaVersion = SCHEMA_VERSION;
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
