import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/vault-auth";
import { listVideos, uploadVideo, VideoCategory } from "@/modules/vault/services/video.service";

// ---------------------------------------------------------------------------
// GET /api/hr-videos
// Query params: category, isRequired, search, page, limit
// ---------------------------------------------------------------------------

export const GET = withAuth(async (req, user) => {
  const { searchParams } = new URL(req.url);

  const result = await listVideos({
    category:   (searchParams.get("category") ?? undefined) as VideoCategory | undefined,
    isRequired: searchParams.has("isRequired")
      ? searchParams.get("isRequired") === "true"
      : undefined,
    search: searchParams.get("search") ?? undefined,
    page:   searchParams.get("page")  ? parseInt(searchParams.get("page")!,  10) : undefined,
    limit:  searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : undefined,
    user,
  });

  const page  = parseInt(searchParams.get("page")  ?? "1",  10);
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);

  return NextResponse.json({
    success: true,
    data:    result.rows,
    meta: {
      total:      result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    },
  });
});

// ---------------------------------------------------------------------------
// POST /api/hr-videos
// Body: multipart/form-data — file + metadata fields
// ---------------------------------------------------------------------------

export const POST = withAuth(async (req: NextRequest, user) => {
  const form = await req.formData();
  const file = form.get("file") as File | null;

  if (!file || file.size === 0) {
    return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
  }

  const title = (form.get("title") as string | null)?.trim();
  if (!title) {
    return NextResponse.json({ success: false, error: "title is required" }, { status: 400 });
  }

  const category = form.get("category") as VideoCategory | null;
  if (!category) {
    return NextResponse.json({ success: false, error: "category is required" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const video = await uploadVideo({
    title,
    description:  (form.get("description") as string | null) ?? undefined,
    category,
    accessLevel:  (form.get("accessLevel") as string | null) as "ALL" | "MANAGER_ONLY" | "HR_ONLY" | "CUSTOM" | undefined,
    isRequired:   form.get("isRequired") === "true",
    expiresAt:    (form.get("expiresAt") as string | null) ?? undefined,
    buffer,
    originalName: file.name,
    mimetype:     file.type || "video/mp4",
    fileSize:     file.size,
    uploadedBy:   user.sub,
  });

  return NextResponse.json({ success: true, data: video }, { status: 201 });
}, "MANAGER");
