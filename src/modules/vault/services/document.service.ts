import { v4 as uuidv4 } from "uuid";
import { query, queryRows, queryOne, withTransaction } from "@/lib/vault-db";
import { uploadBuffer, deleteFile } from "@/lib/vault-storage";
import { validateDocumentFile, sanitizeStorageKey } from "@/lib/vault-validators";
import { canAccessVaultResource, createVaultError, JwtPayload, VaultAccessLevel } from "@/lib/vault-auth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DocumentCategory = "POLICY" | "CONTRACT" | "HANDBOOK" | "FORM" | "SOP" | "COMPLIANCE" | "OTHER";
export type DocumentStatus   = "ACTIVE" | "ARCHIVED" | "EXPIRED";

export interface HrDocument {
  id:           string;
  title:        string;
  description:  string | null;
  category:     DocumentCategory;
  fileUrl:      string;
  fileKey:      string;
  fileType:     string;
  fileSize:     number;
  version:      number;
  parentId:     string | null;
  isLatest:     boolean;
  accessLevel:  VaultAccessLevel;
  allowedRoles: string[];
  allowedStaff: string[];
  tags:         string[];
  metadata:     Record<string, unknown>;
  requiresAck:  boolean;
  expiresAt:    Date | null;
  status:       DocumentStatus;
  warningLevel: "none" | "low" | "medium" | "high";
  employeeId:   string | null;
  uploadedBy:   string;
  isDeleted:    boolean;
  createdAt:    Date;
  updatedAt:    Date;
}

export interface DocAcknowledgement {
  id:             string;
  documentId:     string;
  staffId:        string;
  acknowledgedAt: Date;
  ipAddress:      string | null;
  userAgent:      string | null;
  signature:      string | null;
  notes:          string | null;
  isDeleted:      boolean;
  createdAt:      Date;
  updatedAt:      Date;
}

export interface UploadDocumentInput {
  title:         string;
  description?:  string;
  category:      DocumentCategory;
  accessLevel?:  VaultAccessLevel;
  allowedRoles?: string[];
  allowedStaff?: string[];
  tags?:         string[];
  requiresAck?:  boolean;
  expiresAt?:    string;
  metadata?:     Record<string, unknown>;
  buffer:        Buffer;
  originalName:  string;
  mimetype:      string;
  fileSize:      number;
  uploadedBy:    string;
}

export interface ListDocumentsInput {
  category?:     DocumentCategory;
  status?:       DocumentStatus;
  warningLevel?: "none" | "low" | "medium" | "high";
  requiresAck?:  boolean;
  page?:         number;
  limit?:        number;
  search?:       string;
  scope?:        "mine" | "company";
  user:          JwtPayload;
}

export interface NewVersionInput {
  parentId:     string;
  title?:       string;
  description?: string;
  buffer:       Buffer;
  originalName: string;
  mimetype:     string;
  fileSize:     number;
  uploadedBy:   string;
}

export interface AcknowledgeInput {
  documentId: string;
  staffId:    string;
  ipAddress?: string;
  userAgent?: string;
  signature?: string;
  notes?:     string;
}

// ---------------------------------------------------------------------------
// Idempotent schema migrations (called once at route startup)
// ---------------------------------------------------------------------------

export async function ensureVaultSchema(): Promise<void> {
  await query(`
    ALTER TABLE "HrDocument"
    ADD COLUMN IF NOT EXISTS "employeeId" TEXT
  `);
  await query(`
    ALTER TABLE "HrDocument"
    ADD COLUMN IF NOT EXISTS "warningLevel" TEXT NOT NULL DEFAULT 'none'
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_hrdoc_warning_level ON "HrDocument"("warningLevel")
  `);
  await query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
  await query(`
    CREATE TABLE IF NOT EXISTS "Notification" (
      id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId"      TEXT         NOT NULL,
      "documentId"  TEXT,
      type          TEXT         NOT NULL DEFAULT 'DOCUMENT_REMINDER',
      message       TEXT         NOT NULL,
      "isRead"      BOOLEAN      NOT NULL DEFAULT false,
      "createdAt"   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_notification_user_id ON "Notification"("userId")`);
  await query(`CREATE INDEX IF NOT EXISTS idx_notification_user_unread ON "Notification"("userId", "isRead") WHERE "isRead" = false`);
}

// ---------------------------------------------------------------------------
// Upload a new document
// ---------------------------------------------------------------------------

export async function uploadDocument(input: UploadDocumentInput): Promise<HrDocument> {
  const validationError = validateDocumentFile(input.mimetype, input.fileSize);
  if (validationError) throw createVaultError(validationError, 422);

  const id           = uuidv4();
  const publicId     = `${sanitizeStorageKey(input.originalName)}_${id}`;
  const folder       = "vault/docs";
  const resourceType = input.mimetype.startsWith("image/") ? "image" : "raw";

  const storageResult = await uploadBuffer(input.buffer, publicId, folder, resourceType, input.fileSize);

  const row = await queryOne<HrDocument>(`
    INSERT INTO "HrDocument" (
      id, title, description, category,
      "fileUrl", "fileKey", "fileType", "fileSize",
      version, "isLatest",
      "accessLevel", "allowedRoles", "allowedStaff",
      tags, metadata, "requiresAck", "expiresAt", status,
      "uploadedBy"
    ) VALUES (
      $1,  $2,  $3,  $4,
      $5,  $6,  $7,  $8,
      1,   true,
      $9,  $10, $11,
      $12, $13, $14, $15, 'ACTIVE',
      $16
    )
    RETURNING *
  `, [
    id,
    input.title,
    input.description   ?? null,
    input.category,
    storageResult.url,
    storageResult.key,
    input.mimetype,
    input.fileSize,
    input.accessLevel   ?? "ALL",
    input.allowedRoles  ?? [],
    input.allowedStaff  ?? [],
    input.tags          ?? [],
    JSON.stringify(input.metadata ?? {}),
    input.requiresAck   ?? false,
    input.expiresAt     ?? null,
    input.uploadedBy,
  ]);

  return row!;
}

// ---------------------------------------------------------------------------
// List documents (with access control + filters)
// ---------------------------------------------------------------------------

export async function listDocuments(
  input: ListDocumentsInput
): Promise<{ rows: HrDocument[]; total: number }> {
  const page   = Math.max(1, input.page  ?? 1);
  const limit  = Math.min(100, Math.max(1, input.limit ?? 20));
  const offset = (page - 1) * limit;

  const conditions: string[] = [`"isDeleted" = false`, `"isLatest" = true`];
  const params: unknown[]    = [];
  let   p = 1;

  if (input.category) {
    conditions.push(`category = $${p++}`);
    params.push(input.category);
  }
  if (input.requiresAck !== undefined) {
    conditions.push(`"requiresAck" = $${p++}`);
    params.push(input.requiresAck);
  }
  if (input.status) {
    conditions.push(`status = $${p++}`);
    params.push(input.status);
  }
  if (input.search) {
    conditions.push(`(title ILIKE $${p} OR description ILIKE $${p})`);
    params.push(`%${input.search}%`);
    p++;
  }
  if (input.warningLevel) {
    conditions.push(`"warningLevel" = $${p++}`);
    params.push(input.warningLevel);
  }

  if (input.scope === "mine") {
    conditions.push(`"employeeId" = $${p++}`);
    params.push(input.user.sub);
  } else if (input.scope === "company") {
    conditions.push(`"employeeId" IS NULL`);
  } else if (input.user.role !== "ADMIN") {
    conditions.push(`("employeeId" IS NULL OR "employeeId" = $${p++})`);
    params.push(input.user.sub);
  }

  const where = conditions.join(" AND ");

  const countRow = await queryOne<{ total: string }>(
    `SELECT COUNT(*) AS total FROM "HrDocument" WHERE ${where}`,
    params
  );
  const total = parseInt(countRow?.total ?? "0", 10);

  params.push(limit, offset);
  const rows = await queryRows<HrDocument>(
    `SELECT * FROM "HrDocument"
     WHERE ${where}
     ORDER BY "createdAt" DESC
     LIMIT $${p} OFFSET $${p + 1}`,
    params
  );

  const accessible = rows.filter((doc) => {
    if (doc.employeeId) {
      return doc.employeeId === input.user.sub || input.user.role === "ADMIN";
    }
    return canAccessVaultResource(
      input.user,
      doc.accessLevel as VaultAccessLevel,
      doc.allowedRoles,
      doc.allowedStaff
    );
  });

  return { rows: accessible, total };
}

// ---------------------------------------------------------------------------
// Get single document by ID
// ---------------------------------------------------------------------------

export async function getDocumentById(id: string, user: JwtPayload): Promise<HrDocument> {
  const doc = await queryOne<HrDocument>(
    `SELECT * FROM "HrDocument" WHERE id = $1 AND "isDeleted" = false`,
    [id]
  );
  if (!doc) throw createVaultError("Document not found", 404);

  if (!canAccessVaultResource(user, doc.accessLevel as VaultAccessLevel, doc.allowedRoles, doc.allowedStaff)) {
    throw createVaultError("You do not have permission to access this document", 403);
  }

  // Auto-expire check
  if (doc.expiresAt && new Date(doc.expiresAt) < new Date() && doc.status === "ACTIVE") {
    await query(
      `UPDATE "HrDocument" SET status = 'EXPIRED', "updatedAt" = NOW() WHERE id = $1`,
      [id]
    );
    doc.status = "EXPIRED";
  }

  return doc;
}

// ---------------------------------------------------------------------------
// Create a new version of an existing document
// ---------------------------------------------------------------------------

export async function createNewVersion(input: NewVersionInput): Promise<HrDocument> {
  const validationError = validateDocumentFile(input.mimetype, input.fileSize);
  if (validationError) throw createVaultError(validationError, 422);

  const parent = await queryOne<HrDocument>(
    `SELECT * FROM "HrDocument"
     WHERE (id = $1 OR "parentId" = $1) AND "isLatest" = true AND "isDeleted" = false
     ORDER BY version DESC LIMIT 1`,
    [input.parentId]
  );
  if (!parent) throw createVaultError("Parent document not found", 404);

  const rootId       = parent.parentId ?? parent.id;
  const id           = uuidv4();
  const publicId     = `${sanitizeStorageKey(input.originalName)}_${id}`;
  const folder       = "vault/docs";
  const resourceType = input.mimetype.startsWith("image/") ? "image" : "raw";

  const storageResult = await uploadBuffer(input.buffer, publicId, folder, resourceType, input.fileSize);

  return withTransaction(async (client) => {
    await client.query(
      `UPDATE "HrDocument" SET "isLatest" = false, "updatedAt" = NOW()
       WHERE (id = $1 OR "parentId" = $1) AND "isLatest" = true`,
      [rootId]
    );

    const { rows } = await client.query<HrDocument>(`
      INSERT INTO "HrDocument" (
        id, title, description, category,
        "fileUrl", "fileKey", "fileType", "fileSize",
        version, "parentId", "isLatest",
        "accessLevel", "allowedRoles", "allowedStaff",
        tags, metadata, "requiresAck", "expiresAt", status,
        "uploadedBy"
      ) VALUES (
        $1,  $2,  $3,  $4,
        $5,  $6,  $7,  $8,
        $9,  $10, true,
        $11, $12, $13,
        $14, $15, $16, $17, 'ACTIVE',
        $18
      )
      RETURNING *
    `, [
      id,
      input.title       ?? parent.title,
      input.description ?? parent.description,
      parent.category,
      storageResult.url,
      storageResult.key,
      input.mimetype,
      input.fileSize,
      parent.version + 1,
      rootId,
      parent.accessLevel,
      parent.allowedRoles,
      parent.allowedStaff,
      parent.tags,
      JSON.stringify(parent.metadata),
      parent.requiresAck,
      parent.expiresAt,
      input.uploadedBy,
    ]);

    return rows[0];
  });
}

// ---------------------------------------------------------------------------
// Update document status
// ---------------------------------------------------------------------------

export async function updateDocumentStatus(
  id:     string,
  status: DocumentStatus
): Promise<HrDocument> {
  const doc = await queryOne<HrDocument>(
    `UPDATE "HrDocument"
     SET status = $2, "updatedAt" = NOW()
     WHERE id = $1 AND "isDeleted" = false
     RETURNING *`,
    [id, status]
  );
  if (!doc) throw createVaultError("Document not found", 404);
  return doc;
}

// ---------------------------------------------------------------------------
// Soft-delete a document
// ---------------------------------------------------------------------------

export async function softDeleteDocument(id: string): Promise<void> {
  const doc = await queryOne<{ fileKey: string; fileType: string }>(
    `SELECT "fileKey", "fileType" FROM "HrDocument" WHERE id = $1 AND "isDeleted" = false`,
    [id]
  );
  if (!doc) throw createVaultError("Document not found", 404);

  await query(
    `UPDATE "HrDocument" SET "isDeleted" = true, "updatedAt" = NOW() WHERE id = $1`,
    [id]
  );

  const resourceType = (doc.fileType ?? "").startsWith("image/") ? "image" : "raw";
  await deleteFile(doc.fileKey, resourceType).catch(() => {/* non-fatal */});
}

// ---------------------------------------------------------------------------
// Acknowledge a document
// ---------------------------------------------------------------------------

export async function acknowledgeDocument(input: AcknowledgeInput): Promise<DocAcknowledgement> {
  const doc = await queryOne<HrDocument>(
    `SELECT id, status FROM "HrDocument"
     WHERE id = $1 AND "isDeleted" = false AND "isLatest" = true`,
    [input.documentId]
  );
  if (!doc) throw createVaultError("Document not found", 404);
  if (doc.status === "ARCHIVED") throw createVaultError("Cannot acknowledge an archived document", 400);

  const id  = uuidv4();
  const row = await queryOne<DocAcknowledgement>(`
    INSERT INTO "DocAcknowledgement" (
      id, "documentId", "staffId",
      "acknowledgedAt", "ipAddress", "userAgent", signature, notes
    ) VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7)
    ON CONFLICT ("documentId", "staffId")
    DO UPDATE SET
      "acknowledgedAt" = NOW(),
      "ipAddress"  = EXCLUDED."ipAddress",
      "userAgent"  = EXCLUDED."userAgent",
      signature    = EXCLUDED.signature,
      notes        = EXCLUDED.notes,
      "updatedAt"  = NOW()
    RETURNING *
  `, [
    id,
    input.documentId,
    input.staffId,
    input.ipAddress ?? null,
    input.userAgent ?? null,
    input.signature ?? null,
    input.notes     ?? null,
  ]);

  return row!;
}

// ---------------------------------------------------------------------------
// Get acknowledgement status for a document
// ---------------------------------------------------------------------------

export async function getAckStatus(documentId: string): Promise<{
  acknowledgedCount: number;
  acknowledgements:  DocAcknowledgement[];
}> {
  const doc = await queryOne(
    `SELECT id FROM "HrDocument" WHERE id = $1 AND "isDeleted" = false`,
    [documentId]
  );
  if (!doc) throw createVaultError("Document not found", 404);

  const acknowledgements = await queryRows<DocAcknowledgement>(
    `SELECT * FROM "DocAcknowledgement"
     WHERE "documentId" = $1 AND "isDeleted" = false
     ORDER BY "acknowledgedAt" DESC`,
    [documentId]
  );

  return { acknowledgedCount: acknowledgements.length, acknowledgements };
}
