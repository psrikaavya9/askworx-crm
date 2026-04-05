import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/vault-auth";
import { createNewVersion } from "@/modules/vault/services/document.service";

// ---------------------------------------------------------------------------
// PUT /api/hr-documents/version
// Body: multipart/form-data — file + parentId + optional title/description
// ---------------------------------------------------------------------------

export const PUT = withAuth(async (req: NextRequest, user) => {
  const form = await req.formData();
  const file = form.get("file") as File | null;

  if (!file || file.size === 0) {
    return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
  }

  const parentId = (form.get("parentId") as string | null)?.trim();
  if (!parentId) {
    return NextResponse.json({ success: false, error: "parentId is required" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const doc = await createNewVersion({
    parentId,
    title:       (form.get("title")       as string | null) ?? undefined,
    description: (form.get("description") as string | null) ?? undefined,
    buffer,
    originalName: file.name,
    mimetype:    file.type || "application/octet-stream",
    fileSize:    file.size,
    uploadedBy:  user.sub,
  });

  return NextResponse.json({ success: true, data: doc }, { status: 201 });
}, "MANAGER");
