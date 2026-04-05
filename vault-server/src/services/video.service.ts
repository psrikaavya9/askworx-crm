import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import { queryRows, queryOne } from "../db/pool";
import { uploadFile, uploadThumbnail, deleteFile } from "./storage.service";
import { processVideo, cleanupTempFiles } from "../utils/ffmpeg.util";
import { validateVideoFile, sanitizeStorageKey } from "../utils/validators.util";
import { createError } from "../middleware/error.middleware";
import { canAccessVaultResource } from "../middleware/rbac.middleware";
import {
  HrVideo, VideoWatchLog,
  VideoCategory, VaultAccessLevel, JwtPayload,
} from "../types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UploadVideoInput {
  title:        string;
  description?: string;
  category:     VideoCategory;
  accessLevel?: VaultAccessLevel;
  allowedRoles?: string[];
  allowedStaff?: string[];
  tags?:         string[];
  isRequired?:   boolean;
  expiresAt?:    string;
  metadata?:     Record<string, unknown>;
  localPath:     string;
  originalName:  string;
  mimetype:      string;
  fileSize:      number;
  uploadedBy:    string;
}

export interface ListVideosInput {
  category?:   VideoCategory;
  isRequired?: boolean;
  page?:       number;
  limit?:      number;
  search?:     string;
  user:        JwtPayload;
}

export interface WatchProgressInput {
  videoId:        string;
  staffId:        string;
  watchedSeconds: number;
  totalSeconds:   number;
  lastPosition:   number;
  sessionData?:   Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Upload video → store original → async FFmpeg processing
// ---------------------------------------------------------------------------

export async function uploadVideo(
  input: UploadVideoInput
): Promise<HrVideo> {
  // 1. Validate
  const err = validateVideoFile(input.mimetype, input.fileSize);
  if (err) throw createError(err, 422);

  const id       = uuidv4();
  const publicId = `${sanitizeStorageKey(input.originalName)}_${id}`;

  // 2. Upload original to Cloudinary (sets status = PROCESSING)
  let originalResult;
  try {
    originalResult = await uploadFile(
      input.localPath,
      `${publicId}_orig`,
      "vault/videos/raw",
      "video"
    );
  } catch (uploadErr) {
    if (fs.existsSync(input.localPath)) fs.unlinkSync(input.localPath);
    throw uploadErr;
  }

  // 3. Insert DB record (status = PROCESSING)
  const row = await queryOne<HrVideo>(`
    INSERT INTO "HrVideo" (
      id, title, description, category,
      "originalUrl", "fileKey", "fileSize",
      status,
      "accessLevel", "allowedRoles", "allowedStaff",
      tags, metadata, "isRequired", "expiresAt",
      "uploadedBy"
    ) VALUES (
      $1,  $2,  $3,  $4,
      $5,  $6,  $7,
      'PROCESSING',
      $8,  $9,  $10,
      $11, $12, $13, $14,
      $15
    )
    RETURNING *
  `, [
    id,
    input.title,
    input.description ?? null,
    input.category,
    originalResult.url,
    originalResult.key,
    input.fileSize,
    input.accessLevel  ?? "ALL",
    input.allowedRoles ?? [],
    input.allowedStaff ?? [],
    input.tags         ?? [],
    JSON.stringify(input.metadata ?? {}),
    input.isRequired   ?? false,
    input.expiresAt    ?? null,
    input.uploadedBy,
  ]);

  // 4. Kick off async FFmpeg processing (fire-and-forget)
  processVideoAsync(id, input.localPath, publicId, originalResult.key).catch(
    (e) => console.error(`[vault] FFmpeg failed for video ${id}:`, e.message)
  );

  return row!;
}

// ---------------------------------------------------------------------------
// Background: process video with FFmpeg, upload processed + thumbnail
// ---------------------------------------------------------------------------

async function processVideoAsync(
  videoId:    string,
  localPath:  string,
  publicId:   string,
  originalKey: string
): Promise<void> {
  let processedPath = "";
  let thumbPath     = "";

  try {
    // 1. Run FFmpeg
    const result = await processVideo(localPath, videoId);
    processedPath = result.processedPath;
    thumbPath     = result.thumbnailPath;

    // 2. Upload processed mp4
    const processedResult = await uploadFile(
      result.processedPath,
      `${publicId}_proc`,
      "vault/videos/processed",
      "video"
    );

    // 3. Upload thumbnail
    const thumbUrl = await uploadThumbnail(result.thumbnailPath, `${publicId}_thumb`);

    // 4. Update DB — status = READY
    await queryOne(`
      UPDATE "HrVideo"
      SET
        "processedUrl" = $2,
        "thumbnailUrl" = $3,
        duration       = $4,
        metadata       = metadata || $5::jsonb,
        status         = 'READY',
        "updatedAt"    = NOW()
      WHERE id = $1
    `, [
      videoId,
      processedResult.url,
      thumbUrl,
      result.duration,
      JSON.stringify(result.metadata),
    ]);
  } catch (err) {
    // Mark as FAILED in DB
    await queryOne(
      `UPDATE "HrVideo" SET status = 'FAILED', "updatedAt" = NOW() WHERE id = $1`,
      [videoId]
    );
    throw err;
  } finally {
    // Cleanup all temp files
    cleanupTempFiles(localPath, processedPath, thumbPath);
    // Optionally delete the raw original from Cloudinary to save space
    await deleteFile(originalKey, "video").catch(() => {/* non-fatal */});
  }
}

// ---------------------------------------------------------------------------
// List videos
// ---------------------------------------------------------------------------

export async function listVideos(
  input: ListVideosInput
): Promise<{ rows: HrVideo[]; total: number }> {
  const page   = Math.max(1, input.page  ?? 1);
  const limit  = Math.min(100, Math.max(1, input.limit ?? 20));
  const offset = (page - 1) * limit;

  const conditions: string[] = [`"isDeleted" = false`];
  const params: unknown[] = [];
  let p = 1;

  if (input.category) {
    conditions.push(`category = $${p++}`);
    params.push(input.category);
  }
  if (input.isRequired !== undefined) {
    conditions.push(`"isRequired" = $${p++}`);
    params.push(input.isRequired);
  }
  if (input.search) {
    conditions.push(`(title ILIKE $${p} OR description ILIKE $${p})`);
    params.push(`%${input.search}%`);
    p++;
  }

  const where = conditions.join(" AND ");

  const countRow = await queryOne<{ total: string }>(
    `SELECT COUNT(*) AS total FROM "HrVideo" WHERE ${where}`,
    params
  );
  const total = parseInt(countRow?.total ?? "0", 10);

  params.push(limit, offset);
  const rows = await queryRows<HrVideo>(
    `SELECT * FROM "HrVideo"
     WHERE ${where}
     ORDER BY "createdAt" DESC
     LIMIT $${p} OFFSET $${p + 1}`,
    params
  );

  const accessible = rows.filter((v) =>
    canAccessVaultResource(
      input.user,
      v.accessLevel as VaultAccessLevel,
      v.allowedRoles,
      v.allowedStaff
    )
  );

  return { rows: accessible, total };
}

// ---------------------------------------------------------------------------
// Get video by ID
// ---------------------------------------------------------------------------

export async function getVideoById(
  id:   string,
  user: JwtPayload
): Promise<HrVideo> {
  const video = await queryOne<HrVideo>(
    `SELECT * FROM "HrVideo" WHERE id = $1 AND "isDeleted" = false`,
    [id]
  );
  if (!video) throw createError("Video not found", 404);

  if (!canAccessVaultResource(user, video.accessLevel as VaultAccessLevel, video.allowedRoles, video.allowedStaff)) {
    throw createError("You do not have permission to access this video", 403);
  }

  // Auto-expire
  if (video.expiresAt && new Date(video.expiresAt) < new Date()) {
    await queryOne(
      `UPDATE "HrVideo" SET "isDeleted" = true, "updatedAt" = NOW() WHERE id = $1`,
      [id]
    );
    throw createError("This video has expired and is no longer available", 410);
  }

  return video;
}

// ---------------------------------------------------------------------------
// Upsert watch progress
// ---------------------------------------------------------------------------

export async function upsertWatchProgress(
  input: WatchProgressInput
): Promise<VideoWatchLog> {
  // Validate video exists
  const video = await queryOne<HrVideo>(
    `SELECT id, duration FROM "HrVideo" WHERE id = $1 AND "isDeleted" = false`,
    [input.videoId]
  );
  if (!video) throw createError("Video not found", 404);

  const totalSeconds = input.totalSeconds > 0
    ? input.totalSeconds
    : (video.duration ?? input.watchedSeconds);

  const percentage = totalSeconds > 0
    ? Math.min(100, Math.round((input.watchedSeconds / totalSeconds) * 100 * 100) / 100)
    : 0;

  const completed = percentage >= 95;

  const id  = uuidv4();
  const row = await queryOne<VideoWatchLog>(`
    INSERT INTO "VideoWatchLog" (
      id, "videoId", "staffId",
      "watchedSeconds", "totalSeconds", percentage,
      completed, "lastPosition", "sessionData"
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT ("videoId", "staffId")
    DO UPDATE SET
      "watchedSeconds" = GREATEST("VideoWatchLog"."watchedSeconds", EXCLUDED."watchedSeconds"),
      "totalSeconds"   = EXCLUDED."totalSeconds",
      percentage       = GREATEST("VideoWatchLog".percentage,       EXCLUDED.percentage),
      completed        = "VideoWatchLog".completed OR EXCLUDED.completed,
      "lastPosition"   = EXCLUDED."lastPosition",
      "sessionData"    = EXCLUDED."sessionData",
      "updatedAt"      = NOW()
    RETURNING *
  `, [
    id,
    input.videoId,
    input.staffId,
    input.watchedSeconds,
    totalSeconds,
    percentage,
    completed,
    input.lastPosition,
    JSON.stringify(input.sessionData ?? {}),
  ]);

  return row!;
}

// ---------------------------------------------------------------------------
// Get watch progress for a staff member on a video
// ---------------------------------------------------------------------------

export async function getWatchProgress(
  videoId: string,
  staffId: string
): Promise<VideoWatchLog | null> {
  const video = await queryOne(
    `SELECT id FROM "HrVideo" WHERE id = $1 AND "isDeleted" = false`,
    [videoId]
  );
  if (!video) throw createError("Video not found", 404);

  return queryOne<VideoWatchLog>(
    `SELECT * FROM "VideoWatchLog"
     WHERE "videoId" = $1 AND "staffId" = $2 AND "isDeleted" = false`,
    [videoId, staffId]
  );
}

// ---------------------------------------------------------------------------
// Get all watch logs for a video (admin/manager view)
// ---------------------------------------------------------------------------

export async function getAllWatchLogs(videoId: string): Promise<VideoWatchLog[]> {
  const video = await queryOne(
    `SELECT id FROM "HrVideo" WHERE id = $1 AND "isDeleted" = false`,
    [videoId]
  );
  if (!video) throw createError("Video not found", 404);

  return queryRows<VideoWatchLog>(
    `SELECT * FROM "VideoWatchLog"
     WHERE "videoId" = $1 AND "isDeleted" = false
     ORDER BY "updatedAt" DESC`,
    [videoId]
  );
}
