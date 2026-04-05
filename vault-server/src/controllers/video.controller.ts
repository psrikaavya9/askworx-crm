import { Response, NextFunction } from "express";
import { z } from "zod";
import { AuthRequest, VideoCategory, VaultAccessLevel, JwtPayload } from "../types";
import * as videoService from "../services/video.service";
import { sendCreated, sendSuccess, sendPaginated, sendError } from "../utils/response.util";

// Dev-mode fallback — mirrors the one in document.controller.ts
const DEV_USER: JwtPayload = {
  sub:   "dev-admin",
  email: "dev@askworx.com",
  role:  "ADMIN",
  iat:   0,
  exp:   9_999_999_999,
};

const getUser = (req: AuthRequest): JwtPayload => req.user ?? DEV_USER;

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const UploadVideoSchema = z.object({
  title:        z.string().min(1).max(255),
  description:  z.string().optional(),
  category:     z.enum(["ONBOARDING","TRAINING","SAFETY","COMPLIANCE","GENERAL"]),
  accessLevel:  z.enum(["ALL","MANAGER_ONLY","HR_ONLY","CUSTOM"]).optional(),
  allowedRoles: z.array(z.string()).optional(),
  allowedStaff: z.array(z.string()).optional(),
  tags:         z.array(z.string()).optional(),
  isRequired:   z.coerce.boolean().optional(),
  expiresAt:    z.string().datetime({ offset: true }).optional(),
  metadata:     z.record(z.unknown()).optional(),
});

const WatchProgressSchema = z.object({
  videoId:        z.string().uuid(),
  watchedSeconds: z.coerce.number().int().min(0),
  totalSeconds:   z.coerce.number().int().min(0),
  lastPosition:   z.coerce.number().int().min(0),
  sessionData:    z.record(z.unknown()).optional(),
});

// ---------------------------------------------------------------------------
// POST /videos/upload
// ---------------------------------------------------------------------------

export async function uploadVideo(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.file) {
      sendError(res, "No file uploaded. Use multipart/form-data with field 'file'.", 400);
      return;
    }

    const body = UploadVideoSchema.safeParse(req.body);
    if (!body.success) {
      sendError(res, body.error.errors.map((e) => e.message).join("; "), 422);
      return;
    }

    const video = await videoService.uploadVideo({
      ...body.data,
      localPath:    req.file.path,
      originalName: req.file.originalname,
      mimetype:     req.file.mimetype,
      fileSize:     req.file.size,
      uploadedBy:   getUser(req).sub,
    });

    sendCreated(res, {
      ...video,
      message:
        "Video uploaded. FFmpeg processing has started. " +
        "Poll GET /videos/:id to check when status becomes READY.",
    });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /videos
// ---------------------------------------------------------------------------

export async function listVideos(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const page       = Math.max(1, parseInt((req.query.page  as string) || "1",  10) || 1);
    const limit      = Math.max(1, parseInt((req.query.limit as string) || "20", 10) || 20);
    const category   = req.query.category   as VideoCategory | undefined;
    const search     = req.query.search     as string        | undefined;
    const isRequired =
      req.query.isRequired !== undefined
        ? req.query.isRequired === "true"
        : undefined;

    const { rows, total } = await videoService.listVideos({
      category, isRequired, search, page, limit,
      user: getUser(req),
    });

    sendPaginated(res, rows, total, page, limit);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /videos/:id
// ---------------------------------------------------------------------------

export async function getVideo(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const video = await videoService.getVideoById(req.params.id, getUser(req));
    sendSuccess(res, video);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// POST /videos/progress
// ---------------------------------------------------------------------------

export async function saveProgress(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = WatchProgressSchema.safeParse(req.body);
    if (!body.success) {
      sendError(res, body.error.errors.map((e) => e.message).join("; "), 422);
      return;
    }

    const log = await videoService.upsertWatchProgress({
      videoId:        body.data.videoId,
      staffId:        getUser(req).sub,
      watchedSeconds: body.data.watchedSeconds,
      totalSeconds:   body.data.totalSeconds,
      lastPosition:   body.data.lastPosition,
      sessionData:    {
        ...body.data.sessionData,
        userAgent: req.headers["user-agent"],
        ip:        req.ip,
      },
    });

    sendSuccess(res, log);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /videos/:id/progress  — own progress or all logs (manager+)
// ---------------------------------------------------------------------------

export async function getProgress(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user      = getUser(req);
    const isManager = user.role === "ADMIN" || user.role === "MANAGER";

    // ?staffId=xxx  (manager viewing specific staff member's log)
    const targetStaffId = isManager && req.query.staffId
      ? (req.query.staffId as string)
      : user.sub;

    // Manager with no staffId filter → return ALL logs for this video
    if (isManager && !req.query.staffId) {
      const logs = await videoService.getAllWatchLogs(req.params.id);
      sendSuccess(res, logs);
      return;
    }

    const log = await videoService.getWatchProgress(req.params.id, targetStaffId);
    sendSuccess(res, log ?? { completed: false, percentage: 0, lastPosition: 0 });
  } catch (err) {
    next(err);
  }
}
