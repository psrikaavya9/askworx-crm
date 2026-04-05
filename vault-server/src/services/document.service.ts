import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import { query, queryRows, queryOne, withTransaction } from "../db/pool";
import { uploadFile, deleteFile } from "./storage.service";
import { validateDocumentFile, sanitizeStorageKey } from "../utils/validators.util";
import { createError } from "../middleware/error.middleware";
import { HrDocument, DocAcknowledgement, VaultAccessLevel, DocumentCategory, DocumentStatus, JwtPayload } from "../types";
import { canAccessVaultResource } from "../middleware/rbac.middleware";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UploadDocumentInput {
  title:        string;
  description?: string;
  category:     DocumentCategory;
  accessLevel?: VaultAccessLevel;
  allowedRoles?: string[];
  allowedStaff?: string[];
  tags?:         string[];
  requiresAck?:  boolean;
  expiresAt?:    string;   // ISO date string
  metadata?:     Record<string, unknown>;
  localPath:     string;
  originalName:  string;
  mimetype:      string;
  fileSize:      number;
  uploadedBy:    string;
}

export interface ListDocumentsInput {
  category?:     DocumentCategory;
  status?:       DocumentStatus;
  warningLevel?: "none" | "low" | "medium" | "high";
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
  localPath:    string;
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
// Idempotent DDL — add employeeId column if it doesn't exist yet
// ---------------------------------------------------------------------------

export async function ensureEmployeeIdColumn(): Promise<void> {
  await query(`
    ALTER TABLE "HrDocument"
    ADD COLUMN IF NOT EXISTS "employeeId" TEXT
  `);
}

// ---------------------------------------------------------------------------
// Upload a new document
// ---------------------------------------------------------------------------

export async function uploadDocument(
  input: UploadDocumentInput
): Promise<HrDocument> {
  // 1. Validate file
  const validationError = validateDocumentFile(input.mimetype, input.fileSize);
  if (validationError) throw createError(validationError, 422);

  // 2. Upload to Cloudinary
  const id        = uuidv4();
  const publicId  = `${sanitizeStorageKey(input.originalName)}_${id}`;
  const folder    = "vault/docs";
  const resourceType = input.mimetype.startsWith("image/") ? "image" : "raw";

  let storageResult;
  try {
    storageResult = await uploadFile(
      input.localPath,
      publicId,
      folder,
      resourceType
    );
  } finally {
    // Always clean up temp file
    if (fs.existsSync(input.localPath)) fs.unlinkSync(input.localPath);
  }

  // 3. Persist to DB
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
    input.description ?? null,
    input.category,
    storageResult.url,
    storageResult.key,
    input.mimetype,
    input.fileSize,
    input.accessLevel  ?? "ALL",
    input.allowedRoles ?? [],
    input.allowedStaff ?? [],
    input.tags         ?? [],
    JSON.stringify(input.metadata ?? {}),
    input.requiresAck  ?? false,
    input.expiresAt    ?? null,
    input.uploadedBy,
  ]);

  return row!;
}

// ---------------------------------------------------------------------------
// List documents with access control + optional filters
// ---------------------------------------------------------------------------

export async function listDocuments(
  input: ListDocumentsInput
): Promise<{ rows: HrDocument[]; total: number }> {
  const page  = Math.max(1, input.page  ?? 1);
  const limit = Math.min(100, Math.max(1, input.limit ?? 20));
  const offset = (page - 1) * limit;

  const conditions: string[] = [
    `"isDeleted" = false`,
    `"isLatest"  = true`,
  ];
  const params: unknown[] = [];
  let p = 1;

  if (input.category) {
    conditions.push(`category = $${p++}`);
    params.push(input.category);
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

  // Scope filter
  if (input.scope === "mine") {
    // Documents explicitly assigned to this employee
    conditions.push(`"employeeId" = $${p++}`);
    params.push(input.user.sub);
  } else if (input.scope === "company") {
    // General company-wide documents only
    conditions.push(`"employeeId" IS NULL`);
  } else {
    // No scope: if not admin, show both company docs and their personal docs
    if (input.user.role !== "ADMIN") {
      conditions.push(`("employeeId" IS NULL OR "employeeId" = $${p++})`);
      params.push(input.user.sub);
    }
    // Admins see everything — no extra condition
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

  // Apply access control filter in-memory (avoids complex SQL for CUSTOM rules)
  const accessible = rows.filter((doc) => {
    // [DEBUG] — remove after verification
    console.log(`[listDocuments] USER: ${input.user.sub} (${input.user.role}) | DOC: "${doc.title}" | employeeId: ${doc.employeeId ?? "null"}`);

    // Employee-specific docs: visible to the assigned employee or any admin
    if (doc.employeeId) {
      const allowed = doc.employeeId === input.user.sub || input.user.role === "ADMIN";
      console.log(`[listDocuments]   → employee-specific: allowed=${allowed}`);
      return allowed;
    }
    // General docs: follow normal RBAC
    const allowed = canAccessVaultResource(
      input.user,
      doc.accessLevel as VaultAccessLevel,
      doc.allowedRoles,
      doc.allowedStaff
    );
    console.log(`[listDocuments]   → company doc (${doc.accessLevel}): allowed=${allowed}`);
    return allowed;
  });

  return { rows: accessible, total };
}

// ---------------------------------------------------------------------------
// Get single document by ID
// ---------------------------------------------------------------------------

export async function getDocumentById(
  id:   string,
  user: JwtPayload
): Promise<HrDocument> {
  const doc = await queryOne<HrDocument>(
    `SELECT * FROM "HrDocument" WHERE id = $1 AND "isDeleted" = false`,
    [id]
  );
  if (!doc) throw createError("Document not found", 404);

  if (!canAccessVaultResource(user, doc.accessLevel as VaultAccessLevel, doc.allowedRoles, doc.allowedStaff)) {
    throw createError("You do not have permission to access this document", 403);
  }

  // Auto-expire check
  if (doc.expiresAt && new Date(doc.expiresAt) < new Date() && doc.status === "ACTIVE") {
    await queryOne(
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

export async function createNewVersion(
  input: NewVersionInput
): Promise<HrDocument> {
  const validationError = validateDocumentFile(input.mimetype, input.fileSize);
  if (validationError) throw createError(validationError, 422);

  // Get the current latest version to inherit metadata
  const parent = await queryOne<HrDocument>(
    `SELECT * FROM "HrDocument"
     WHERE (id = $1 OR "parentId" = $1)
       AND "isLatest" = true
       AND "isDeleted" = false
     ORDER BY version DESC LIMIT 1`,
    [input.parentId]
  );
  if (!parent) throw createError("Parent document not found", 404);

  // Determine root ID (for version chain)
  const rootId = parent.parentId ?? parent.id;

  // Upload new file
  const id        = uuidv4();
  const publicId  = `${sanitizeStorageKey(input.originalName)}_${id}`;
  const folder    = "vault/docs";
  const resourceType = input.mimetype.startsWith("image/") ? "image" : "raw";

  let storageResult;
  try {
    storageResult = await uploadFile(
      input.localPath,
      publicId,
      folder,
      resourceType
    );
  } finally {
    if (fs.existsSync(input.localPath)) fs.unlinkSync(input.localPath);
  }

  // Transaction: mark old version as not-latest, insert new version
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
// Update document status (active / archived / expired)
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
  if (!doc) throw createError("Document not found", 404);
  return doc;
}

// ---------------------------------------------------------------------------
// Soft-delete a document (sets isDeleted = true, removes from Cloudinary)
// ---------------------------------------------------------------------------

export async function softDeleteDocument(id: string): Promise<void> {
  const doc = await queryOne<HrDocument>(
    `SELECT "fileKey", "fileType" FROM "HrDocument" WHERE id = $1 AND "isDeleted" = false`,
    [id]
  );
  if (!doc) throw createError("Document not found", 404);

  await queryOne(
    `UPDATE "HrDocument" SET "isDeleted" = true, "updatedAt" = NOW() WHERE id = $1`,
    [id]
  );

  const resourceType = (doc.fileType ?? "").startsWith("image/") ? "image" : "raw";
  await deleteFile(doc.fileKey, resourceType).catch(() => {/* non-fatal */});
}

// ---------------------------------------------------------------------------
// Acknowledge a document
// ---------------------------------------------------------------------------

export async function acknowledgeDocument(
  input: AcknowledgeInput
): Promise<DocAcknowledgement> {
  // Ensure document exists and requires acknowledgement
  const doc = await queryOne<HrDocument>(
    `SELECT id, "requiresAck", status FROM "HrDocument"
     WHERE id = $1 AND "isDeleted" = false AND "isLatest" = true`,
    [input.documentId]
  );
  if (!doc) throw createError("Document not found", 404);
  if (doc.status === "ARCHIVED") throw createError("Cannot acknowledge an archived document", 400);

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

export interface AckStatus {
  documentId:    string;
  totalStaff:    number;      // from Staff table
  acknowledgedCount: number;
  pendingCount:  number;
  acknowledgements: DocAcknowledgement[];
}

export async function getAckStatus(documentId: string): Promise<{
  acknowledgedCount: number;
  acknowledgements:  DocAcknowledgement[];
}> {
  const doc = await queryOne(
    `SELECT id FROM "HrDocument" WHERE id = $1 AND "isDeleted" = false`,
    [documentId]
  );
  if (!doc) throw createError("Document not found", 404);

  const acknowledgements = await queryRows<DocAcknowledgement>(
    `SELECT * FROM "DocAcknowledgement"
     WHERE "documentId" = $1 AND "isDeleted" = false
     ORDER BY "acknowledgedAt" DESC`,
    [documentId]
  );

  return {
    acknowledgedCount: acknowledgements.length,
    acknowledgements,
  };
}
