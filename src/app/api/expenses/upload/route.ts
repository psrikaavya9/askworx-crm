import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/authMiddleware";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES  = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const UPLOAD_DIR     = join(process.cwd(), "public", "uploads", "receipts");

// ---------------------------------------------------------------------------
// POST /api/expenses/upload
//
// Accepts multipart/form-data with a single "file" field.
// Saves the file to /public/uploads/receipts/ and returns its public URL.
// Max size: 5 MB. Accepted types: JPEG, PNG, WEBP, GIF.
// ---------------------------------------------------------------------------

export const POST = withAuth(async (req: NextRequest) => {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // ── Validate type ─────────────────────────────────────────────────────────
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Only image files are allowed (JPEG, PNG, WEBP, GIF)" },
      { status: 400 }
    );
  }

  // ── Validate size ─────────────────────────────────────────────────────────
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: "File size must be 5 MB or less" },
      { status: 400 }
    );
  }

  // ── Build a collision-proof filename ─────────────────────────────────────
  const ext      = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const filename = `${Date.now()}-${randomUUID()}.${ext}`;
  const buffer   = Buffer.from(await file.arrayBuffer());

  // ── Ensure the upload directory exists ───────────────────────────────────
  await mkdir(UPLOAD_DIR, { recursive: true });

  // ── Write to disk ─────────────────────────────────────────────────────────
  await writeFile(join(UPLOAD_DIR, filename), buffer);

  const url = `/uploads/receipts/${filename}`;
  return NextResponse.json({ success: true, url }, { status: 201 });
});
