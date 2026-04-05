import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/vault-auth";
import {
  listDocuments,
  uploadDocument,
  ensureVaultSchema,
  DocumentCategory,
} from "@/modules/vault/services/document.service";

let schemaReady = false;
async function ensureSchema() {
  if (!schemaReady) {
    await ensureVaultSchema();
    schemaReady = true;
  }
}

// ---------------------------------------------------------------------------
// GET /api/hr-documents
// Query params: category, status, warningLevel, search, page, limit, scope
// ---------------------------------------------------------------------------

export const GET = withAuth(async (req, user) => {
  await ensureSchema();

  const { searchParams } = new URL(req.url);

  const docs = await listDocuments({
    category:     (searchParams.get("category")     ?? undefined) as DocumentCategory | undefined,
    status:       (searchParams.get("status")       ?? undefined) as "ACTIVE" | "ARCHIVED" | "EXPIRED" | undefined,
    warningLevel: (searchParams.get("warningLevel") ?? undefined) as "none" | "low" | "medium" | "high" | undefined,
    requiresAck:  searchParams.has("requiresAck") ? searchParams.get("requiresAck") === "true" : undefined,
    search:       searchParams.get("search")        ?? undefined,
    page:         searchParams.get("page")   ? parseInt(searchParams.get("page")!,  10) : undefined,
    limit:        searchParams.get("limit")  ? parseInt(searchParams.get("limit")!, 10) : undefined,
    scope:        (searchParams.get("scope") ?? undefined) as "mine" | "company" | undefined,
    user,
  });

  const page  = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);

  return NextResponse.json({
    success: true,
    data:    docs.rows,
    meta: {
      total:      docs.total,
      page,
      limit,
      totalPages: Math.ceil(docs.total / limit),
    },
  });
});

// ---------------------------------------------------------------------------
// POST /api/hr-documents
// Body: multipart/form-data — file + metadata fields
// ---------------------------------------------------------------------------

export const POST = withAuth(async (req, user) => {
  await ensureSchema();

  const form = await req.formData();
  const file = form.get("file") as File | null;

  if (!file || file.size === 0) {
    return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
  }

  const title = (form.get("title") as string | null)?.trim();
  if (!title) {
    return NextResponse.json({ success: false, error: "title is required" }, { status: 400 });
  }

  const category = form.get("category") as DocumentCategory | null;
  if (!category) {
    return NextResponse.json({ success: false, error: "category is required" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const tagsRaw  = form.get("tags") as string | null;
  const tagsArr  = tagsRaw ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : [];

  const doc = await uploadDocument({
    title,
    description:  (form.get("description") as string | null) ?? undefined,
    category,
    accessLevel:  (form.get("accessLevel") as string | null) as "ALL" | "MANAGER_ONLY" | "HR_ONLY" | "CUSTOM" | undefined,
    requiresAck:  form.get("requiresAck") === "true",
    expiresAt:    (form.get("expiresAt") as string | null) ?? undefined,
    tags:         tagsArr,
    buffer,
    originalName: file.name,
    mimetype:     file.type || "application/octet-stream",
    fileSize:     file.size,
    uploadedBy:   user.sub,
  });

  return NextResponse.json({ success: true, data: doc }, { status: 201 });
});
